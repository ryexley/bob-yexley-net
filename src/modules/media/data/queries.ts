/**
 * Reader-side media loading (spec §12 Phase 6, handoff fork 1).
 *
 * Phase 6 is pure read UI — these `query()` server fns fetch already-committed
 * `blip_media` rows for the reader surfaces (blip detail page now; feed cards in
 * Phase 7). They are deliberately *decoupled* from the upload-coupled
 * `mediaStore` and from the heavy `view_blips` view:
 *
 * - RLS does the security: `blip_media_select_follows_blip` already grants
 *   public read for media whose parent blip is published (and owner/admin
 *   otherwise), so a plain select is safe for anon readers.
 * - The feed's N-blips fan-out is a single batched `.in(blip_id, [...])` round
 *   trip (`getBlipMediaFor`), mirroring the existing batched `getBlipReactionStates`.
 *
 * The pure pieces (`selectBlipMedia`, `groupMediaByBlipId`) are exported so they
 * can be unit-tested with the Supabase-client mock, without the `"use server"`
 * boundary.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { query } from "@solidjs/router"
import type { Tables } from "@/types/database.types"

export type BlipMediaRow = Tables<"blip_media">

/**
 * Select committed `blip_media` rows for one or more blips, ordered by
 * `display_order`. Returns `[]` for an empty id set without hitting the network.
 */
export async function selectBlipMedia(
  supabase: SupabaseClient,
  blipIds: string[],
): Promise<BlipMediaRow[]> {
  const ids = [...new Set((blipIds ?? []).filter(Boolean))]
  if (ids.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from("blip_media")
    .select("*")
    .in("blip_id", ids)
    .order("display_order", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as BlipMediaRow[]
}

/**
 * Group flat media rows by `blip_id`, preserving the `display_order` ordering
 * from the query. Blips with no media simply have no key in the result.
 */
export function groupMediaByBlipId(
  rows: BlipMediaRow[],
): Record<string, BlipMediaRow[]> {
  const byBlip: Record<string, BlipMediaRow[]> = {}
  for (const row of rows) {
    ;(byBlip[row.blip_id] ??= []).push(row)
  }
  return byBlip
}

type UpdateBlipRef = Pick<
  Tables<"blips">,
  "id" | "parent_id" | "publish_at" | "created_at"
>

/**
 * Published update blip ids grouped by root, newest first (matches the default
 * detail-page update ordering used when flattening feed-card / lightbox media).
 */
export async function selectUpdateBlipIdsByRoot(
  supabase: SupabaseClient,
  rootBlipIds: string[],
): Promise<Record<string, string[]>> {
  const ids = [...new Set((rootBlipIds ?? []).filter(Boolean))]
  if (ids.length === 0) {
    return {}
  }

  const { data, error } = await supabase
    .from("blips")
    .select("id, parent_id, publish_at, created_at")
    .in("parent_id", ids)
    .eq("blip_type", "update")

  if (error) {
    throw error
  }

  const byRoot: Record<string, Array<{ id: string; publishAt: string }>> = {}
  for (const row of (data ?? []) as UpdateBlipRef[]) {
    if (!row.parent_id) {
      continue
    }
    const publishAt = row.publish_at ?? row.created_at
    ;(byRoot[row.parent_id] ??= []).push({ id: row.id, publishAt })
  }

  const result: Record<string, string[]> = {}
  for (const [rootId, updates] of Object.entries(byRoot)) {
    updates.sort(
      (left, right) =>
        new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime(),
    )
    result[rootId] = updates.map(update => update.id)
  }

  return result
}

/**
 * Flatten root + update blip media into one page-wide lightbox carousel list:
 * root items first (by `display_order`), then each update's items in top-to-bottom
 * page order (the caller supplies update blip ids in visual scroll order).
 */
export function flattenBlipPageMedia(
  rootMedia: BlipMediaRow[],
  mediaByBlip: Record<string, BlipMediaRow[]>,
  updateBlipIdsInPageOrder: string[],
): BlipMediaRow[] {
  const pageMedia = [...rootMedia]
  for (const blipId of updateBlipIdsInPageOrder) {
    const rows = mediaByBlip[blipId]
    if (rows?.length) {
      pageMedia.push(...rows)
    }
  }
  return pageMedia
}

/** Map committed media row ids to their index in a flattened page list. */
export function indexMediaById(media: BlipMediaRow[]): Map<string, number> {
  return new Map(media.map((row, index) => [row.id, index]))
}

/** Committed media for a single blip (detail page entry point). */
export const getBlipMedia = query(async (blipId: string) => {
  "use server"

  if (!blipId) {
    return [] as BlipMediaRow[]
  }

  const { getServerClient } = await import("@/lib/vendor/supabase/server")
  const supabase = await getServerClient()
  return selectBlipMedia(supabase, [blipId])
}, "blip-media")

/**
 * Committed media for many blips in one batched round trip — used to load a
 * blip detail graph's root + updates together, and (Phase 7) a feed page.
 */
export const getBlipMediaFor = query(async (blipIds: string[]) => {
  "use server"

  const { getServerClient } = await import("@/lib/vendor/supabase/server")
  const supabase = await getServerClient()
  return selectBlipMedia(supabase, blipIds ?? [])
}, "blip-media-for")

/** Update blip ids for feed-card media flattening (batched by root). */
export const getUpdateBlipIdsForRoots = query(async (rootBlipIds: string[]) => {
  "use server"

  const { getServerClient } = await import("@/lib/vendor/supabase/server")
  const supabase = await getServerClient()
  return selectUpdateBlipIdsByRoot(supabase, rootBlipIds ?? [])
}, "blip-update-ids-for-roots")
