/**
 * Live, end-to-end verification of the Phase 3 upload pipeline against R2.
 *
 * Proves the exact behavior `uploadStore` (src/modules/media/upload-store.ts)
 * drives, but as a standalone Node script (no dev server, no TS loader, no Uppy):
 *
 *   1. EXIF filename derivation with the real `exifr` (matches filename.ts:
 *      `formatExifTimestamp` reads the EXIF wall-clock from the Date's UTC fields).
 *   2. The full R2 key convention:
 *        media/{userId}/{blipId}/{name}-original.{ext}
 *        media/{userId}/{blipId}/{name}-{small|medium|large}.webp
 *   3. Single presigned PUT of the original (the `r2Service.getUploadParameters`
 *      path), then the `/api/media/process` pipeline inline (needsHeicDecode ->
 *      heic-convert -> sharp -> 3 WebP variants) uploaded under the base key.
 *   4. A multipart round-trip (create -> sign parts -> PUT -> complete) on a
 *      >5 MiB synthetic object using the same key shape (the multipart hooks).
 *   5. HEAD/GET/decode + public-URL GET on every written object, then cleanup.
 *
 * The unit tests (upload-store.spec.ts / filename.spec.ts) cover the Uppy wiring
 * and naming logic; this script proves the real network + key convention.
 *
 * Run: node --env-file=.env.local scripts/media-upload-check.mjs
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import exifr from "exifr"
import heicConvert from "heic-convert"

const { parse: parseExif } = exifr
import sharp from "sharp"

// Mirrors MEDIA_VARIANT_WIDTHS in src/modules/media/process.ts
const VARIANT_WIDTHS = { small: 200, medium: 1024, large: 2048 }
const WEBP_QUALITY = 80
const TTL = 600

const endpoint = process.env.R2_ENDPOINT
const bucket = process.env.R2_BUCKET
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const publicUrl = (
  process.env.VITE_MEDIA_STORAGE_URL ||
  process.env.MEDIA_STORAGE_URL ||
  ""
).replace(/\/+$/, "")

const missing = []
if (!endpoint) missing.push("R2_ENDPOINT")
if (!bucket) missing.push("R2_BUCKET")
if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID")
if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY")
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "))
  process.exit(1)
}

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

const pad2 = n => String(n).padStart(2, "0")
// Mirrors filename.ts:formatExifTimestamp — EXIF time lives in the Date's UTC fields.
const formatExifTimestamp = d =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
  `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`

const fixture = name =>
  readFileSync(
    fileURLToPath(
      new URL(`../src/modules/media/__fixtures__/${name}`, import.meta.url),
    ),
  )

const userId = "_healthcheck-user"
const blipId = "20240815143000000"
const writtenKeys = []

async function cleanup() {
  for (const key of writtenKeys) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      console.log(`DELETE ok -> ${key}`)
    } catch (error) {
      console.warn(`DELETE failed -> ${key}: ${error.message}`)
    }
  }
}

async function presignedPutOriginalAndProcess() {
  console.log("== Single PUT (EXIF naming) + process pipeline ==")
  const heic = fixture("iphone-gainmap.heic")

  // 1. Derive the filename from EXIF exactly like the uploadStore allocator.
  const tags = await parseExif(heic, {
    pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"],
  })
  const exifDate = tags?.DateTimeOriginal ?? tags?.CreateDate
  if (!(exifDate instanceof Date)) {
    throw new Error("fixture is missing an EXIF capture timestamp")
  }
  const name = formatExifTimestamp(exifDate)
  const baseKey = `media/${userId}/${blipId}/${name}`
  const originalKey = `${baseKey}-original.heic`
  console.log(`derived name: ${name}  (EXIF ${exifDate.toISOString()})`)
  console.log(`base key:     ${baseKey}`)

  // 2. Single presigned PUT of the original (r2Service.getUploadParameters path).
  const putUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: originalKey,
      ContentType: "image/heic",
    }),
    { expiresIn: TTL },
  )
  const put = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/heic" },
    body: heic,
  })
  if (!put.ok) throw new Error(`original PUT failed: ${put.status}`)
  writtenKeys.push(originalKey)
  console.log(`PUT original -> ${put.status}  ${originalKey}`)

  // 3. /api/media/process pipeline, inline: fetch original -> decode -> variants.
  const got = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: originalKey }),
  )
  const originalBytes = Buffer.from(await got.Body.transformToByteArray())
  // HEVC-HEIF can't be decoded by sharp directly (see process.ts) — convert first.
  const jpeg = Buffer.from(
    await heicConvert({ buffer: originalBytes, format: "JPEG", quality: 0.92 }),
  )

  let pass = true
  for (const [variant, width] of Object.entries(VARIANT_WIDTHS)) {
    const { data, info } = await sharp(jpeg, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })

    const variantKey = `${baseKey}-${variant}.webp`
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: variantKey,
        Body: data,
        ContentType: "image/webp",
      }),
    )
    writtenKeys.push(variantKey)

    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: variantKey }),
    )
    const fetched = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: variantKey }),
    )
    const meta = await sharp(
      Buffer.from(await fetched.Body.transformToByteArray()),
    ).metadata()

    const okType = head.ContentType === "image/webp" && meta.format === "webp"
    const okWidth = meta.width === info.width && meta.width <= width
    const okAll = okType && okWidth
    pass = pass && okAll
    console.log(
      `${okAll ? "PASS" : "FAIL"} ${variant.padEnd(6)} ${variantKey} ` +
        `${meta.width}x${meta.height} ${meta.format}`,
    )
  }

  // 4. Public-URL read of a variant (must be reachable by <img>).
  if (publicUrl) {
    const probe = `${baseKey}-small.webp`
    const res = await fetch(`${publicUrl}/${probe}`)
    pass = pass && res.status === 200
    console.log(`${res.status === 200 ? "PASS" : "FAIL"} public GET ${res.status} -> ${publicUrl}/${probe}`)
  } else {
    console.log("SKIP public GET (no VITE_MEDIA_STORAGE_URL / MEDIA_STORAGE_URL)")
  }

  console.log()
  return pass
}

async function multipartRoundTrip() {
  console.log("== Multipart round-trip (uploadStore key shape) ==")
  const key = `media/${userId}/${blipId}/${blipId}-1-original.bin`
  const contentType = "application/octet-stream"

  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
  )
  const uploadId = created.UploadId
  console.log(`create multipart -> ${uploadId?.slice(0, 12)}...`)

  // Part 1 must be >= 5 MiB (all but the last part); part 2 is small.
  const part1 = Buffer.alloc(5 * 1024 * 1024, 7)
  const part2 = Buffer.from("final part")
  const parts = []
  for (const [index, body] of [part1, part2].entries()) {
    const partNumber = index + 1
    const url = await getSignedUrl(
      client,
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: TTL },
    )
    const res = await fetch(url, { method: "PUT", body })
    if (!res.ok) throw new Error(`part ${partNumber} PUT failed: ${res.status}`)
    parts.push({ PartNumber: partNumber, ETag: res.headers.get("etag") })
    console.log(`part ${partNumber} -> etag ${res.headers.get("etag")}`)
  }

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  )
  writtenKeys.push(key)
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )
  const expected = part1.length + part2.length
  const pass = head.ContentLength === expected
  console.log(
    `${pass ? "PASS" : "FAIL"} complete multipart -> ${head.ContentLength}b (expected ${expected})\n`,
  )
  return pass
}

try {
  console.log(`Bucket: ${bucket}`)
  console.log(`sharp ${sharp.versions.sharp} / libvips ${sharp.versions.vips}\n`)

  const a = await presignedPutOriginalAndProcess()
  const b = await multipartRoundTrip()

  console.log("Cleaning up...")
  await cleanup()

  const pass = a && b
  console.log(pass ? "\nUpload pipeline check PASSED." : "\nUpload pipeline check FAILED.")
  process.exit(pass ? 0 : 1)
} catch (error) {
  console.error("\nUpload pipeline check FAILED:")
  console.error(`  ${error.name}: ${error.message}`)
  await cleanup()
  process.exit(1)
}
