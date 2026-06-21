import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"

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

const key = `media/_healthcheck/${Date.now()}.txt`
const body = "r2 connectivity check"

try {
  console.log(`Bucket: ${bucket}`)
  console.log(`Endpoint: ${endpoint}`)

  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "text/plain" }),
  )
  console.log(`PUT    ok -> ${key}`)

  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  console.log(`HEAD   ok -> ${head.ContentLength} bytes, ${head.ContentType}`)

  const get = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const text = await get.Body.transformToString()
  console.log(`GET    ok -> "${text}"`)

  if (publicUrl) {
    const res = await fetch(`${publicUrl}/${key}`)
    console.log(`PUBLIC ${res.status} -> ${publicUrl}/${key}`)
  }

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  console.log(`DELETE ok -> ${key}`)

  console.log("\nR2 credentials and bucket are working.")
} catch (error) {
  console.error("\nR2 check FAILED:")
  console.error(`  ${error.name}: ${error.message}`)
  process.exit(1)
}
