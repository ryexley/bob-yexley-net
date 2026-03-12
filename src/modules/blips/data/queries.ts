import { query } from "@solidjs/router"
import type { Blip } from "@/modules/blips/data/schema"

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

export const getBlips = query(async (limit: number = 20, offset: number = 0) => {
  "use server"

  const { getClient } = await import("@/lib/vendor/supabase")
  const supabase = getClient()

  const { data, error } = await supabase
    .from("blips")
    .select("*, blip_tags(tag:tags(name))")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  return mapBlipsWithTags((data ?? []) as BlipWithTagRows[])
}, "blips")

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

  const [mapped] = mapBlipsWithTags([data as BlipWithTagRows])
  return mapped
}, "blip")
