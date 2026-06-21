/**
 * Server-side Cloudflare R2 client.
 *
 * Trust boundary:
 * - Server-only usage. R2 credentials must NEVER reach the browser.
 * - Uses the S3-compatible API that R2 exposes.
 *
 * Usage:
 * - Import from server routes / server modules only (e.g. the blips media routes).
 */
import { S3Client } from "@aws-sdk/client-s3"
import { getEnv } from "@/util/env"

let r2Client: S3Client | null = null

type R2Config = {
  bucket: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
}

export function getR2Config(): R2Config {
  const env = getEnv()
  const missing: string[] = []

  if (!env.R2_ENDPOINT) {
    missing.push("R2_ENDPOINT")
  }
  if (!env.R2_BUCKET) {
    missing.push("R2_BUCKET")
  }
  if (!env.R2_ACCESS_KEY_ID) {
    missing.push("R2_ACCESS_KEY_ID")
  }
  if (!env.R2_SECRET_ACCESS_KEY) {
    missing.push("R2_SECRET_ACCESS_KEY")
  }

  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(", ")}`)
  }

  return {
    bucket: env.R2_BUCKET,
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  }
}

export function getR2Client(): S3Client {
  if (!r2Client) {
    const config = getR2Config()
    r2Client = new S3Client({
      // R2 is region-agnostic but the SDK requires a value; "auto" is R2's convention.
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  return r2Client
}
