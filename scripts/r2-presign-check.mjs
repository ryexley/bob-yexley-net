// Verifies the presigning mechanics used by src/modules/media/server.ts:
//   1. Single presigned PUT upload -> public GET -> delete
//   2. Full multipart round-trip (create -> sign parts -> PUT parts -> complete -> delete)
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const endpoint = process.env.R2_ENDPOINT
const bucket = process.env.R2_BUCKET
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const publicUrl = (process.env.VITE_MEDIA_STORAGE_URL || "").replace(/\/+$/, "")

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

const TTL = 600

async function singlePutCheck() {
  console.log("== Single presigned PUT ==")
  const key = `media/_presign/${Date.now()}-single.txt`
  const contentType = "text/plain"

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: TTL },
  )
  console.log("signed PUT url ok")

  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: "hello from presigned put",
  })
  console.log(`PUT via signed url -> ${put.status}`)
  if (!put.ok) throw new Error(`PUT failed: ${put.status}`)

  const get = await fetch(`${publicUrl}/${key}`)
  console.log(`public GET -> ${get.status}`)

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  console.log("delete ok\n")
}

async function multipartCheck() {
  console.log("== Multipart round-trip ==")
  const key = `media/_presign/${Date.now()}-multipart.bin`
  const contentType = "application/octet-stream"

  const created = await client.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
  )
  const uploadId = created.UploadId
  console.log(`create multipart -> uploadId ${uploadId?.slice(0, 12)}...`)

  // Part 1 must be >= 5 MiB (all but the last part). Part 2 is small.
  const part1 = Buffer.alloc(5 * 1024 * 1024, 1)
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
    const etag = res.headers.get("etag")
    parts.push({ PartNumber: partNumber, ETag: etag })
    console.log(`part ${partNumber} uploaded (${body.length} bytes) -> etag ${etag}`)
  }

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  )
  console.log("complete multipart ok")

  const get = await fetch(`${publicUrl}/${key}`)
  console.log(`public GET -> ${get.status}, length ${get.headers.get("content-length")}`)

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  console.log("delete ok\n")
}

try {
  await singlePutCheck()
  await multipartCheck()
  console.log("All presign checks passed.")
} catch (error) {
  console.error("\nPresign check FAILED:")
  console.error(`  ${error.name}: ${error.message}`)
  process.exit(1)
}
