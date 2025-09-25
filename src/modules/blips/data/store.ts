import type { SupabaseClient } from "@supabase/supabase-js"
import type { Blip } from "@/modules/blips/data/schema"
import { createMemo } from "solid-js"
import {
  supaStore,
  type OperationResult,
  type StoreOptions,
} from "@/lib/data/supa-store"
import { formatDate } from "@/util/formatters"

export const blipId = () =>
  formatDate(new Date().toISOString(), "yyyyMMddHHmmssSSS")

const _blipStore = supaStore<Blip>("blips", blipId)

export function blipStore(
  supabaseClient: SupabaseClient,
  options?: StoreOptions,
) {
  const store = _blipStore(supabaseClient, options)

  const drafts = createMemo(() => {
    return store
      .entities()
      .filter(blip => !blip.published)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
  })

  const publish = async (blipId: string): Promise<OperationResult<Blip>> => {
    // Get the existing blip to ensure we have user_id
    const existingBlip = store.entities().find(b => b.id === blipId)
    if (!existingBlip) {
      return { data: null, error: "Blip not found" }
    }

    return store.upsert({
      id: blipId,
      user_id: existingBlip.user_id, // Include user_id for RLS
      published: true,
      moderation_status: "approved",
      updated_at: new Date().toISOString(),
    } as Partial<Blip>)
  }

  const unpublish = async (blipId: string): Promise<OperationResult<Blip>> => {
    // Get the existing blip to ensure we have user_id
    const existingBlip = store.entities().find(b => b.id === blipId)
    if (!existingBlip) {
      return { data: null, error: "Blip not found" }
    }

    return store.upsert({
      id: blipId,
      user_id: existingBlip.user_id, // Include user_id for RLS
      published: false,
      updated_at: new Date().toISOString(),
    } as Partial<Blip>)
  }

  return {
    ...store,
    drafts,
    publish,
    unpublish,
  }
}
