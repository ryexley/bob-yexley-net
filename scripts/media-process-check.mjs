/**
 * Live, end-to-end verification of the media image-processing path against R2.
 *
 * Mirrors the logic of src/modules/media/server.ts `processMedia` +
 * src/modules/media/process.ts (the unit tests in process.spec.ts cover the pure
 * transform; this script proves the real R2 round-trip + key convention +
 * public-URL read). The processing is reimplemented inline because this is a
 * standalone Node script (no TS loader).
 *
 * Run: node --env-file=.env.local scripts/media-process-check.mjs
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import sharp from "sharp"

// Mirrors MEDIA_VARIANT_WIDTHS in src/modules/media/process.ts
const VARIANT_WIDTHS = { small: 200, medium: 1024, large: 2048 }
const WEBP_QUALITY = 80

const endpoint = process.env.R2_ENDPOINT
const bucket = process.env.R2_BUCKET
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const publicUrl = process.env.VITE_MEDIA_STORAGE_URL || process.env.MEDIA_STORAGE_URL

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

const SOURCE_W = 3000
const SOURCE_H = 2000
const base = `media/_healthcheck/${Date.now()}/photo`
const originalKey = `${base}-original.jpg`
const writtenKeys = [originalKey]

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

try {
  console.log(`Bucket: ${bucket}`)
  console.log(`sharp ${sharp.versions.sharp} / libvips ${sharp.versions.vips}\n`)

  // 1. Build a realistic source image (gaussian noise compresses non-trivially).
  const source = await sharp({
    create: {
      width: SOURCE_W,
      height: SOURCE_H,
      channels: 3,
      noise: { type: "gaussian", mean: 128, sigma: 30 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
  console.log(`source: ${SOURCE_W}x${SOURCE_H} jpeg (${source.length} bytes)`)

  // 2. Upload the original.
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: originalKey,
      Body: source,
      ContentType: "image/jpeg",
    }),
  )
  console.log(`PUT    ok -> ${originalKey}\n`)

  // 3. Fetch original back (as processMedia does) and generate variants.
  const got = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: originalKey }),
  )
  const originalBytes = Buffer.from(await got.Body.transformToByteArray())

  let pass = true
  for (const [variant, width] of Object.entries(VARIANT_WIDTHS)) {
    const { data, info } = await sharp(originalBytes, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })

    const variantKey = `${base}-${variant}.webp`
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: variantKey,
        Body: data,
        ContentType: "image/webp",
      }),
    )
    writtenKeys.push(variantKey)

    // 4. Verify it landed: HEAD + GET + decode confirms dimensions/format.
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: variantKey }),
    )
    const fetched = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: variantKey }),
    )
    const fetchedBytes = Buffer.from(await fetched.Body.transformToByteArray())
    const meta = await sharp(fetchedBytes).metadata()

    const expectedWidth = Math.min(width, SOURCE_W)
    const okWidth = info.width === expectedWidth && meta.width === expectedWidth
    const okType = head.ContentType === "image/webp" && meta.format === "webp"
    const okRoundTrip = fetchedBytes.length === data.length
    const okAll = okWidth && okType && okRoundTrip
    pass = pass && okAll

    console.log(
      `${okAll ? "PASS" : "FAIL"} ${variant.padEnd(6)} ${variantKey}\n` +
        `      ${meta.width}x${meta.height} ${meta.format} ` +
        `head=${head.ContentType} ${head.ContentLength}b roundtrip=${okRoundTrip}`,
    )
  }

  // 5. Public-URL read (variants must be reachable by <img>).
  if (publicUrl) {
    const probeKey = `${base}-small.webp`
    const res = await fetch(`${publicUrl}/${probeKey}`)
    const okPublic = res.status === 200
    pass = pass && okPublic
    console.log(
      `\n${okPublic ? "PASS" : "FAIL"} public GET ${res.status} -> ${publicUrl}/${probeKey}`,
    )
  } else {
    console.log("\nSKIP public GET (no VITE_MEDIA_STORAGE_URL / MEDIA_STORAGE_URL)")
  }

  console.log("\nCleaning up...")
  await cleanup()

  console.log(pass ? "\nMedia processing round-trip PASSED." : "\nMedia processing FAILED.")
  process.exit(pass ? 0 : 1)
} catch (error) {
  console.error("\nMedia processing check FAILED:")
  console.error(`  ${error.name}: ${error.message}`)
  await cleanup()
  process.exit(1)
}
