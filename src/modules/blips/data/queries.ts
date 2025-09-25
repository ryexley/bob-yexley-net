import { query } from "@solidjs/router"
import type { Blip } from "@/modules/blips/data/schema"

export const getBlips = query(async (limit: number = 20, offset: number = 0) => {
  "use server"

  const { getClient } = await import("@/lib/vendor/supabase")
  const supabase = getClient()

  const { data, error } = await supabase
    .from("blips")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  return data as Blip[]
}, "blips")

export const getBlip = query(async (id: string) => {
  "use server"

  const { getClient } = await import("@/lib/vendor/supabase")
  const supabase = getClient()

  const { data, error } = await supabase
    .from("blips")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as Blip | null) ?? null
}, "blip")
