import type { SupabaseClient } from "@supabase/supabase-js"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"
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
type Unsubscribe = () => void

export type BlipUpdateWatchHandlers = {
  onInsert?: (blip: Blip) => void
  onUpdate?: (blip: Blip) => void
  onDelete?: (blipId: string) => void
}

export function blipStore(
  supabaseClient: SupabaseClient,
  options?: StoreOptions,
) {
  const store = _blipStore(supabaseClient, options)
  const sortByCreatedAtDesc = (items: Blip[]) =>
    [...items].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

  const drafts = createMemo(() => {
    return store
      .entities()
      .filter(blip => !blip.published)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
  })

  const updatesByParent = (parentId?: string | null): Blip[] => {
    if (!parentId) {
      return []
    }

    return sortByCreatedAtDesc(
      store
        .entities()
        .filter(
          blip =>
            blip.blip_type === BLIP_TYPES.UPDATE && blip.parent_id === parentId,
        ),
    )
  }

  const mergeIntoCache = (blips: Blip[]) => {
    if (blips.length === 0) {
      return
    }

    const byId = new Map(store.entities().map(blip => [blip.id, blip]))
    for (const blip of blips) {
      byId.set(blip.id, blip)
    }

    store.setInitialData([...byId.values()])
  }

  const removeFromCache = (blipId: string) => {
    if (!blipId) {
      return
    }

    store.setInitialData(store.entities().filter(blip => blip.id !== blipId))
  }

  // Domain-level realtime contract for update streams scoped to a root blip.
  const watchUpdates = (
    parentId: string,
    handlers: BlipUpdateWatchHandlers = {},
  ): Unsubscribe => {
    if (!parentId) {
      return () => {}
    }

    const channel = supabaseClient
      .channel(`blip-updates-${parentId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "blips",
          filter: `parent_id=eq.${parentId}`,
        },
        (payload: { new: Blip }) => {
          const incoming = payload.new
          if (incoming.blip_type !== BLIP_TYPES.UPDATE) {
            return
          }

          void store.upsert(incoming, { cacheOnly: true })
          handlers.onInsert?.(incoming)
        },
      )
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "blips",
        },
        (payload: { new: Blip }) => {
          const incoming = payload.new
          if (
            incoming.blip_type !== BLIP_TYPES.UPDATE ||
            incoming.parent_id !== parentId
          ) {
            return
          }

          void store.upsert(incoming, { cacheOnly: true })
          handlers.onUpdate?.(incoming)
        },
      )
      .on(
        "postgres_changes" as any,
        {
          event: "DELETE",
          schema: "public",
          table: "blips",
        },
        (payload: { old: { id: string } }) => {
          const deletedId = payload.old.id
          if (!deletedId) {
            return
          }

          const existing = store.entities().find(blip => blip.id === deletedId)
          if (
            !existing ||
            existing.blip_type !== BLIP_TYPES.UPDATE ||
            existing.parent_id !== parentId
          ) {
            return
          }

          removeFromCache(deletedId)
          handlers.onDelete?.(deletedId)
        },
      )
      .subscribe()

    return () => {
      void supabaseClient.removeChannel(channel)
    }
  }

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

  const fetchTagsForBlip = async (blipId: string): Promise<string[] | null> => {
    const { data: blipTagRows, error: blipTagError } = await supabaseClient
      .from("blip_tags")
      .select("tag_id")
      .eq("blip_id", blipId)

    if (blipTagError) {
      return null
    }

    const tagIds = [
      ...new Set((blipTagRows ?? []).map(row => row.tag_id).filter(Boolean)),
    ]
    if (tagIds.length === 0) {
      return []
    }

    const { data: tagRows, error: tagsError } = await supabaseClient
      .from("tags")
      .select("name")
      .in("id", tagIds)
      .order("name", { ascending: true })

    if (tagsError) {
      return null
    }

    const tags = [...new Set((tagRows ?? []).map(row => row.name).filter(Boolean))]

    return tags.sort() as string[]
  }

  const preservePresentationFields = async (
    result: OperationResult<Blip>,
    existingBlip: Blip,
  ): Promise<OperationResult<Blip>> => {
    if (!result.data) {
      return result
    }

    const fallbackTags =
      existingBlip.tags === undefined
        ? await fetchTagsForBlip(result.data.id)
        : existingBlip.tags

    const presentationFields: Partial<Blip> = {
      tags: fallbackTags ?? [],
      updates_count: existingBlip.updates_count,
    }

    const merged = await store.upsert(
      {
        ...result.data,
        ...presentationFields,
      },
      { cacheOnly: true },
    )

    if (merged.error || !merged.data) {
      return result
    }

    return { data: merged.data, error: null }
  }

  const publishWithPreservedFields = async (
    blipId: string,
  ): Promise<OperationResult<Blip>> => {
    const existingBlip = store.entities().find(b => b.id === blipId)
    if (!existingBlip) {
      return { data: null, error: "Blip not found" }
    }

    const result = await store.upsert({
      id: blipId,
      user_id: existingBlip.user_id,
      published: true,
      moderation_status: "approved",
      updated_at: new Date().toISOString(),
    } as Partial<Blip>)

    return preservePresentationFields(result, existingBlip)
  }

  const unpublishWithPreservedFields = async (
    blipId: string,
  ): Promise<OperationResult<Blip>> => {
    const existingBlip = store.entities().find(b => b.id === blipId)
    if (!existingBlip) {
      return { data: null, error: "Blip not found" }
    }

    const result = await store.upsert({
      id: blipId,
      user_id: existingBlip.user_id,
      published: false,
      updated_at: new Date().toISOString(),
    } as Partial<Blip>)

    return preservePresentationFields(result, existingBlip)
  }

  return {
    ...store,
    drafts,
    updatesByParent,
    mergeIntoCache,
    removeFromCache,
    watchUpdates,
    publish: publishWithPreservedFields,
    unpublish: unpublishWithPreservedFields,
  }
}
