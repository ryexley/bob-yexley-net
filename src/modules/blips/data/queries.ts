import { query } from "@solidjs/router"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BLIP_TYPES,
  type Blip,
  type BlipType,
} from "@/modules/blips/data/schema"

type BlipTagJoinRow = {
  tag: {
    name: string
  } | null
}

type BlipWithTagRows = Blip & {
  blip_tags?: BlipTagJoinRow[]
}

const mapBlipsWithTags = (rows: BlipWithTagRows[]): Blip[] =>
  rows.map(row => {
    const { blip_tags, ...blip } = row
    const tags = [...new Set((blip_tags ?? []).map(link => link.tag?.name).filter(Boolean))].sort()

    return {
      ...blip,
      tags,
    }
  })

const isRootBlip = (blip: Pick<Blip, "parent_id" | "blip_type">) =>
  blip.parent_id === null && blip.blip_type === BLIP_TYPES.ROOT

const withUpdateCounts = async (
  supabase: SupabaseClient,
  rows: BlipWithTagRows[],
): Promise<BlipWithTagRows[]> => {
  if (rows.length === 0) {
    return rows
  }

  const rootIds = rows.map(row => row.id)
  const { data, error } = await supabase
    .from("blips")
    .select("parent_id")
    .eq("blip_type", BLIP_TYPES.UPDATE satisfies BlipType)
    .in("parent_id", rootIds)

  if (error) {
    throw error
  }

  const countByParentId = new Map<string, number>()
  for (const row of data ?? []) {
    const parentId = row.parent_id
    if (!parentId) {
      continue
    }
    countByParentId.set(parentId, (countByParentId.get(parentId) ?? 0) + 1)
  }

  return rows.map(row => ({
    ...row,
    updates_count: countByParentId.get(row.id) ?? 0,
  }))
}

export const getBlips = query(async (limit: number = 20, offset: number = 0) => {
  "use server"

  const { getClient } = await import("@/lib/vendor/supabase")
  const supabase = getClient()

  const { data, error } = await supabase
    .from("blips")
    .select("*, blip_tags(tag:tags(name))")
    .is("parent_id", null)
    .eq("blip_type", BLIP_TYPES.ROOT satisfies BlipType)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  const rowsWithCounts = await withUpdateCounts(
    supabase,
    (data ?? []) as BlipWithTagRows[],
  )
  return mapBlipsWithTags(rowsWithCounts)
}, "blips")

export const getBlipsByTag = query(async (
  tag: string,
  limit: number = 20,
  offset: number = 0,
) => {
  "use server"

  if (!tag) {
    return []
  }

  const { getClient } = await import("@/lib/vendor/supabase")
  const supabase = getClient()

  const { data, error } = await supabase
    .from("blips")
    .select("*, matching_blip_tags:blip_tags!inner(tag:tags!inner(name)), blip_tags(tag:tags(name))")
    .is("parent_id", null)
    .eq("blip_type", BLIP_TYPES.ROOT satisfies BlipType)
    .eq("matching_blip_tags.tag.name", tag)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  const rowsWithCounts = await withUpdateCounts(
    supabase,
    (data ?? []) as BlipWithTagRows[],
  )
  return mapBlipsWithTags(rowsWithCounts)
}, "blips-by-tag")

export const getBlip = query(async (id: string) => {
  "use server"

  const { getClient } = await import("@/lib/vendor/supabase")
  const supabase = getClient()

  const { data, error } = await supabase
    .from("blips")
    .select("*, blip_tags(tag:tags(name))")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  if (!isRootBlip(data as Pick<Blip, "parent_id" | "blip_type">)) {
    return null
  }

  const [mapped] = mapBlipsWithTags([data as BlipWithTagRows])
  return mapped
}, "blip")

export const getBlipUpdates = query(async (rootBlipId: string) => {
  "use server"

  if (!rootBlipId) {
    return []
  }

  const { getClient } = await import("@/lib/vendor/supabase")
  const supabase = getClient()

  const { data, error } = await supabase
    .from("blips")
    .select("*, blip_tags(tag:tags(name))")
    .eq("parent_id", rootBlipId)
    .eq("blip_type", BLIP_TYPES.UPDATE satisfies BlipType)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return mapBlipsWithTags((data ?? []) as BlipWithTagRows[])
}, "blip-updates")
