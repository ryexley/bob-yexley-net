import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3"

const endpoint = process.env.R2_ENDPOINT
const bucket = process.env.R2_BUCKET
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

const corsRules = [
  {
    AllowedOrigins: [
      "https://bob.yexley.net",
      "http://localhost:7808",
      "http://127.0.0.1:7808",
    ],
    AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3600,
  },
]

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: corsRules },
    }),
  )
  console.log("PUT CORS ok")

  const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
  console.log("Current CORS configuration:")
  console.log(JSON.stringify(current.CORSRules, null, 2))
  console.log("\nR2 bucket CORS configured successfully.")
} catch (error) {
  console.error("\nCORS configuration FAILED:")
  console.error(`  ${error.name}: ${error.message}`)
  console.error(
    "\nThe token likely lacks bucket-configuration permission. Configure CORS via the Cloudflare dashboard instead.",
  )
  process.exit(1)
}
