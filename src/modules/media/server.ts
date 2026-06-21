/**
 * Server-side R2 media operations for blips.
 *
 * Trust boundary:
 * - Server-only. Imports the credentialed R2 client and must never reach the browser.
 * - Every operation requires an authenticated user and enforces that the storage
 *   key lives under that user's namespace (`media/{userId}/...`).
 */
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { z } from "zod"
import { getR2Client, getR2Config } from "@/lib/vendor/r2/client"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { processImage } from "./process"
import type {
  AbortMultipartRequest,
  CompleteMultipartRequest,
  CompleteMultipartResponse,
  CreateMultipartRequest,
  CreateMultipartResponse,
  DeleteObjectRequest,
  ListPartsRequest,
  ListPartsResponse,
  MediaResult,
  ProcessMediaRequest,
  ProcessMediaResponse,
  ProcessedVariantInfo,
  SignPartRequest,
  SignPartResponse,
  SignUploadRequest,
  SignUploadResponse,
} from "./types"

const SIGNED_URL_TTL_SECONDS = 600

const ok = <T>(data: T, status = 200): MediaResult<T> => ({ data, error: null, status })
const fail = <T>(error: string, status: number): MediaResult<T> => ({
  data: null,
  error,
  status,
})

/** Serialize a MediaResult into an HTTP JSON Response for API routes. */
export function resultResponse(result: MediaResult<unknown>): Response {
  return new Response(JSON.stringify(result), {
    status: result.status,
    headers: { "content-type": "application/json" },
  })
}

type AuthedUser = { userId: string }

async function requireMediaUser(): Promise<MediaResult<AuthedUser>> {
  try {
    const supabase = await getServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user?.id) {
      return fail("Unauthorized", 401)
    }

    return ok({ userId: user.id })
  } catch (error) {
    console.error("Media auth check failed:", error)
    return fail("Unauthorized", 401)
  }
}

/** Keys must live under the authenticated user's namespace. */
function ownsKey(key: string, userId: string): boolean {
  return key.startsWith(`media/${userId}/`)
}

const keySchema = z.string().min(1).max(1024)
const contentTypeSchema = z.string().min(1).max(255)

const signUploadSchema = z.object({
  key: keySchema,
  contentType: contentTypeSchema,
})
const createMultipartSchema = z.object({
  key: keySchema,
  contentType: contentTypeSchema,
})
const signPartSchema = z.object({
  key: keySchema,
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(10000),
})
const listPartsSchema = z.object({
  key: keySchema,
  uploadId: z.string().min(1),
})
const completeMultipartSchema = z.object({
  key: keySchema,
  uploadId: z.string().min(1),
  parts: z
    .array(
      z.object({
        PartNumber: z.number().int().min(1).max(10000),
        ETag: z.string().min(1),
      }),
    )
    .min(1),
})
const abortMultipartSchema = z.object({
  key: keySchema,
  uploadId: z.string().min(1),
})
const deleteObjectSchema = z.object({
  key: keySchema,
})
const processMediaSchema = z.object({
  key: keySchema,
})

/**
 * Derive the base storage key from an uploaded original's object key.
 * `media/u/b/20240815143022-original.jpg` -> `media/u/b/20240815143022`.
 * Returns null if the key does not follow the `-original.<ext>` convention.
 */
function deriveBaseKey(originalKey: string): string | null {
  const match = originalKey.match(/^(.*)-original\.[^./]+$/)
  return match ? match[1] : null
}

/**
 * Validate the request body, authenticate the user, and assert key ownership.
 * Returns the parsed payload + userId, or a populated error result.
 */
async function authorize<T extends { key: string }>(
  schema: z.ZodType<T>,
  payload: unknown,
): Promise<MediaResult<{ value: T; userId: string }>> {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return fail("Invalid request payload", 400)
  }

  const auth = await requireMediaUser()
  if (!auth.data) {
    return fail(auth.error ?? "Unauthorized", auth.status)
  }

  if (!ownsKey(parsed.data.key, auth.data.userId)) {
    return fail("Forbidden: key is outside your namespace", 403)
  }

  return ok({ value: parsed.data, userId: auth.data.userId })
}

export async function signUpload(
  payload: unknown,
): Promise<MediaResult<SignUploadResponse>> {
  const authorized = await authorize<SignUploadRequest>(signUploadSchema, payload)
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  try {
    const { bucket } = getR2Config()
    const { key, contentType } = authorized.data.value

    const url = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    )

    return ok({ method: "PUT", url, headers: { "Content-Type": contentType } })
  } catch (error) {
    console.error("Failed to sign upload URL:", error)
    return fail("Unable to sign upload URL", 500)
  }
}

export async function createMultipart(
  payload: unknown,
): Promise<MediaResult<CreateMultipartResponse>> {
  const authorized = await authorize<CreateMultipartRequest>(
    createMultipartSchema,
    payload,
  )
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  try {
    const { bucket } = getR2Config()
    const { key, contentType } = authorized.data.value

    const result = await getR2Client().send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
    )

    if (!result.UploadId) {
      return fail("R2 did not return an upload ID", 500)
    }

    return ok({ uploadId: result.UploadId, key })
  } catch (error) {
    console.error("Failed to create multipart upload:", error)
    return fail("Unable to start multipart upload", 500)
  }
}

export async function signPart(
  payload: unknown,
): Promise<MediaResult<SignPartResponse>> {
  const authorized = await authorize<SignPartRequest>(signPartSchema, payload)
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  try {
    const { bucket } = getR2Config()
    const { key, uploadId, partNumber } = authorized.data.value

    const url = await getSignedUrl(
      getR2Client(),
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    )

    return ok({ url })
  } catch (error) {
    console.error("Failed to sign upload part:", error)
    return fail("Unable to sign upload part", 500)
  }
}

export async function listParts(
  payload: unknown,
): Promise<MediaResult<ListPartsResponse>> {
  const authorized = await authorize<ListPartsRequest>(listPartsSchema, payload)
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  try {
    const { bucket } = getR2Config()
    const { key, uploadId } = authorized.data.value

    const result = await getR2Client().send(
      new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
    )

    const parts = (result.Parts ?? [])
      .filter(part => part.PartNumber != null && part.ETag != null)
      .map(part => ({ PartNumber: part.PartNumber as number, ETag: part.ETag as string }))

    return ok({ parts })
  } catch (error) {
    console.error("Failed to list upload parts:", error)
    return fail("Unable to list upload parts", 500)
  }
}

export async function completeMultipart(
  payload: unknown,
): Promise<MediaResult<CompleteMultipartResponse>> {
  const authorized = await authorize<CompleteMultipartRequest>(
    completeMultipartSchema,
    payload,
  )
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  try {
    const { bucket } = getR2Config()
    const { key, uploadId, parts } = authorized.data.value

    const result = await getR2Client().send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .slice()
            .sort((a, b) => a.PartNumber - b.PartNumber)
            .map(part => ({ PartNumber: part.PartNumber, ETag: part.ETag })),
        },
      }),
    )

    return ok({ location: result.Location })
  } catch (error) {
    console.error("Failed to complete multipart upload:", error)
    return fail("Unable to complete multipart upload", 500)
  }
}

export async function abortMultipart(
  payload: unknown,
): Promise<MediaResult<{ aborted: true }>> {
  const authorized = await authorize<AbortMultipartRequest>(
    abortMultipartSchema,
    payload,
  )
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  try {
    const { bucket } = getR2Config()
    const { key, uploadId } = authorized.data.value

    await getR2Client().send(
      new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
    )

    return ok({ aborted: true })
  } catch (error) {
    console.error("Failed to abort multipart upload:", error)
    return fail("Unable to abort multipart upload", 500)
  }
}

export async function deleteObject(
  payload: unknown,
): Promise<MediaResult<{ deleted: true }>> {
  const authorized = await authorize<DeleteObjectRequest>(deleteObjectSchema, payload)
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  try {
    const { bucket } = getR2Config()
    const { key } = authorized.data.value

    await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))

    return ok({ deleted: true })
  } catch (error) {
    console.error("Failed to delete object:", error)
    return fail("Unable to delete object", 500)
  }
}

/**
 * Generate micro/small/medium/large WebP variants for an uploaded original image.
 *
 * Runtime: must run on Vercel's Node.js serverless runtime (sharp's native
 * binary is incompatible with the edge runtime).
 *
 * Flow: authenticate + assert key ownership -> fetch the original from R2 ->
 * generate variants via `sharp` -> upload each variant back to R2 under the
 * `<base>-<variant>.webp` convention -> return the variant keys + dimensions.
 * The original is left untouched. No DB writes happen here; the caller persists
 * the returned keys and flips `processing_status`.
 */
export async function processMedia(
  payload: unknown,
): Promise<MediaResult<ProcessMediaResponse>> {
  const authorized = await authorize<ProcessMediaRequest>(
    processMediaSchema,
    payload,
  )
  if (!authorized.data) {
    return fail(authorized.error ?? "Unauthorized", authorized.status)
  }

  const { key } = authorized.data.value
  const baseKey = deriveBaseKey(key)
  if (!baseKey) {
    return fail("key must reference an -original.<ext> object", 400)
  }

  try {
    const { bucket } = getR2Config()
    const client = getR2Client()

    const original = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    )
    if (!original.Body) {
      return fail("Original object not found", 404)
    }

    const bytes = await original.Body.transformToByteArray()
    const processed = await processImage(bytes)

    const variantEntries = await Promise.all(
      processed.variants.map(async variant => {
        const variantKey = `${baseKey}-${variant.variant}.webp`
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: variantKey,
            Body: variant.data,
            ContentType: variant.contentType,
          }),
        )
        return [
          variant.variant,
          { key: variantKey, width: variant.width, height: variant.height },
        ] as const
      }),
    )

    const variants = Object.fromEntries(
      variantEntries,
    ) as Record<string, ProcessedVariantInfo> as ProcessMediaResponse["variants"]

    return ok({
      storageKey: baseKey,
      original: processed.original,
      variants,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return fail("Original object not found", 404)
    }
    console.error("Failed to process media:", error)
    return fail("Unable to process media", 500)
  }
}
