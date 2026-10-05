/**
 * Admin-only backfill for image `blip_media` rows stuck at
 * `processing_status = 'failed'` (no WebP variants in R2, so readers fall back
 * to the multi-MB original).
 *
 * Trust boundary:
 * - Server-only. Runs as the signed-in user via the request-scoped Supabase
 *   client, so RLS still applies: only the caller's own rows are read and the
 *   update goes through `blip_media_update_owner_valid_session`.
 * - Requires an admin/superuser role on top of a valid session, and every key
 *   must sit in the caller's `media/{userId}/` namespace.
 * - Reuses `generateVariants`, the same R2 + sharp path `/api/media/process`
 *   uses for fresh uploads.
 */
import { z } from "zod"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import { generateVariants } from "./server"
import { originalKeyCandidates } from "./media-utils"
import type { MediaResult } from "./types"

/** Keeps one call well inside the function's 60s `maxDuration`. */
export const REPROCESS_BATCH_DEFAULT = 4
export const REPROCESS_BATCH_MAX = 10

const reprocessSchema = z.object({
  limit: z.number().int().min(1).max(REPROCESS_BATCH_MAX).optional(),
  /** Rows that already failed this session, so a bad row can't block the rest. */
  excludeIds: z.array(z.string().uuid()).max(200).optional(),
})

export type ReprocessFailedMediaResponse = {
  reprocessed: string[]
  failed: Array<{ id: string; error: string }>
  /** Failed image rows still left after this batch (includes `failed`). */
  remaining: number
}

type FailedRow = {
  id: string
  storage_key: string
  mime_type: string
  width: number | null
  height: number | null
}

const ok = <T>(data: T): MediaResult<T> => ({ data, error: null, status: 200 })
const fail = <T>(error: string, status: number): MediaResult<T> => ({
  data: null,
  error,
  status,
})

const isMissing = (error: unknown): boolean =>
  error instanceof Error && error.name === "NoSuchKey"

const failedImagesQuery = (
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  userId: string,
) =>
  supabase
    .from("blip_media")
    .select("id, storage_key, mime_type, width, height", { count: "exact" })
    .eq("user_id", userId)
    .eq("processing_status", "failed")
    .eq("media_type", "image")
    .neq("mime_type", "image/gif")

async function reprocessRow(row: FailedRow): Promise<{
  width: number
  height: number
}> {
  let lastError: unknown = new Error("Original object not found")
  for (const key of originalKeyCandidates(row.storage_key, row.mime_type)) {
    try {
      const result = await generateVariants(key, row.storage_key)
      return result.original
    } catch (error) {
      lastError = error
      if (!isMissing(error)) {
        break
      }
    }
  }
  throw lastError
}

export async function reprocessFailedMedia(
  payload: unknown,
): Promise<MediaResult<ReprocessFailedMediaResponse>> {
  const parsed = reprocessSchema.safeParse(payload ?? {})
  if (!parsed.success) {
    return fail("Invalid request payload", 400)
  }
  const limit = parsed.data.limit ?? REPROCESS_BATCH_DEFAULT
  const excludeIds = parsed.data.excludeIds ?? []

  const supabase = await getServerClient()
  let userId: string
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user?.id) {
      return fail("Unauthorized", 401)
    }
    userId = user.id
  } catch (error) {
    console.error("Reprocess auth check failed:", error)
    return fail("Unauthorized", 401)
  }

  const { data: profile } = await selectUserProfileRecord(supabase, userId)
  if (profile?.role !== "admin" && profile?.role !== "superuser") {
    return fail("Forbidden", 403)
  }

  let batchQuery = failedImagesQuery(supabase, userId)
  if (excludeIds.length > 0) {
    batchQuery = batchQuery.not("id", "in", `(${excludeIds.join(",")})`)
  }
  const { data: rows, error: selectError } = await batchQuery
    .order("created_at", { ascending: true })
    .limit(limit)
  if (selectError) {
    console.error("Failed to load failed media rows:", selectError)
    return fail("Unable to load media", 500)
  }

  const reprocessed: string[] = []
  const failed: ReprocessFailedMediaResponse["failed"] = []

  // Sequential on purpose: each sharp pass holds a full decoded bitmap.
  for (const row of (rows ?? []) as FailedRow[]) {
    if (!row.storage_key.startsWith(`media/${userId}/`)) {
      failed.push({ id: row.id, error: "Key is outside your namespace" })
      continue
    }
    try {
      const original = await reprocessRow(row)
      const { error: updateError } = await supabase
        .from("blip_media")
        .update({
          processing_status: "complete",
          width: row.width ?? original.width,
          height: row.height ?? original.height,
        })
        .eq("id", row.id)
      if (updateError) {
        throw new Error(updateError.message)
      }
      reprocessed.push(row.id)
    } catch (error) {
      console.error(`Failed to reprocess media ${row.id}:`, error)
      failed.push({
        id: row.id,
        error: isMissing(error)
          ? "Original object not found"
          : error instanceof Error
            ? error.message
            : "Unable to process media",
      })
    }
  }

  const { count } = await failedImagesQuery(supabase, userId).limit(0)

  return ok({ reprocessed, failed, remaining: count ?? failed.length })
}
