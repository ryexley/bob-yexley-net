#!/usr/bin/env node
/**
 * Backfill WebP variants for image `blip_media` rows stuck at
 * `processing_status = 'failed'` (every image uploaded while /api/media/process
 * was 500ing after the SolidStart 2 / Nitro 3 upgrade).
 *
 * Dry run by default; pass --apply to write variants to R2 and flip the rows to
 * `complete` (also backfills width/height when missing).
 *
 *   node --env-file=.env.local scripts/reprocess-failed-media.mjs [--apply] [--limit=N]
 *
 * Needs R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Requires Node >= 23.6
 * (imports the TypeScript processing core directly via type stripping).
 */
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import { processImage } from "../src/modules/media/process.ts"

const apply = process.argv.includes("--apply")
const limitArg = process.argv.find(arg => arg.startsWith("--limit="))
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined

const EXT = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heic"],
}

const env = name => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

const bucket = env("R2_BUCKET")
const s3 = new S3Client({
  region: "auto",
  endpoint: env("R2_ENDPOINT"),
  credentials: {
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  },
})
const supabase = createClient(
  env("VITE_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
)

async function readOriginal(storageKey, mimeType) {
  for (const ext of EXT[mimeType] ?? []) {
    try {
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `${storageKey}-original.${ext}`,
        }),
      )
      return await res.Body.transformToByteArray()
    } catch (error) {
      if (error?.name !== "NoSuchKey") {
        throw error
      }
    }
  }
  return null
}

let query = supabase
  .from("blip_media")
  .select("id, storage_key, mime_type, width, height")
  .eq("processing_status", "failed")
  .eq("media_type", "image")
  .neq("mime_type", "image/gif")
  .order("created_at")
if (limit) {
  query = query.limit(limit)
}
const { data: rows, error } = await query
if (error) {
  throw error
}

console.log(`${rows.length} failed image row(s)${apply ? "" : " (dry run)"}`)
let ok = 0
for (const row of rows) {
  const bytes = await readOriginal(row.storage_key, row.mime_type)
  if (!bytes) {
    console.warn(`  skip ${row.storage_key}: original not found`)
    continue
  }
  const started = Date.now()
  const processed = await processImage(bytes)
  const sizes = processed.variants.map(
    v => `${v.variant}=${v.width}px/${Math.round(v.data.length / 1024)}KB`,
  )
  console.log(
    `  ${row.storage_key} (${Math.round(bytes.length / 1024)}KB, ${Date.now() - started}ms) ${sizes.join(" ")}`,
  )
  if (!apply) {
    continue
  }
  for (const variant of processed.variants) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${row.storage_key}-${variant.variant}.webp`,
        Body: variant.data,
        ContentType: variant.contentType,
      }),
    )
  }
  const { error: updateError } = await supabase
    .from("blip_media")
    .update({
      processing_status: "complete",
      width: row.width ?? processed.original.width,
      height: row.height ?? processed.original.height,
    })
    .eq("id", row.id)
  if (updateError) {
    throw updateError
  }
  ok += 1
}
console.log(
  apply
    ? `reprocessed ${ok}/${rows.length}`
    : "dry run complete; re-run with --apply",
)
