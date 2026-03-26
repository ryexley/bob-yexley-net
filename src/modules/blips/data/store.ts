import type { SupabaseClient } from "@supabase/supabase-js"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"
import { createMemo } from "solid-js"
import {
  supaStore,
  type OperationResult,
  type StoreOptions,
} from "@/lib/data/supa-store"
import {
  getBlipReactionState,
  getBlipReactionStates,
  type BlipReactionState,
} from "@/modules/blips/data/queries"
import {
  reconcileViewerReactionState,
  type ReactionViewer,
} from "@/modules/blips/data/reaction-viewer-sync"
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

type BlipReactionWatchHandlers = {
  onRefresh?: (blipId: string) => void
}

type BlipWatchHandlers = {
  onUpdate?: (blip: Blip) => void
}

export function blipStore(
  supabaseClient: SupabaseClient,
  options?: StoreOptions,
) {
  const store = _blipStore(supabaseClient, options)
  const toUniqueBlipIds = (blipIds: string[]) => [...new Set(blipIds.filter(Boolean))]
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

  const applyReactionState = (
    blipId: string,
    reactionState: BlipReactionState,
  ) => {
    const existingBlip = store.entities().find(blip => blip.id === blipId)
    if (!existingBlip) {
      return
    }

    const currentReactions = JSON.stringify(existingBlip.reactions ?? [])
    const nextReactions = JSON.stringify(reactionState.reactions)
    if (
      (existingBlip.reactions_count ?? 0) === reactionState.reactions_count &&
      (existingBlip.my_reaction_count ?? 0) === reactionState.my_reaction_count &&
      currentReactions === nextReactions
    ) {
      return
    }

    void store.upsert(
      {
        ...existingBlip,
        reactions_count: reactionState.reactions_count,
        my_reaction_count: reactionState.my_reaction_count,
        reactions: reactionState.reactions,
      },
      { cacheOnly: true },
    )
  }

  const syncReactionViewer = async (
    blipIds: string[],
    nextViewer: ReactionViewer | null,
    previousViewer: ReactionViewer | null,
  ) => {
    const targetIds = toUniqueBlipIds(blipIds)
    if (targetIds.length === 0) {
      return
    }

    const ownEmojisByBlipId = new Map<string, Set<string>>()
    if (nextViewer?.id) {
      try {
        const { data, error } = await supabaseClient
          .from("reactions")
          .select("blip_id, emoji")
          .eq("visitor_id", nextViewer.id)
          .in("blip_id", targetIds)

        if (error) {
          throw error
        }

        for (const row of data ?? []) {
          const blipId = row.blip_id as string | undefined
          const emoji = row.emoji as string | undefined
          if (!blipId || !emoji) {
            continue
          }

          const existing = ownEmojisByBlipId.get(blipId) ?? new Set<string>()
          existing.add(emoji)
          ownEmojisByBlipId.set(blipId, existing)
        }
      } catch (error) {
        console.error("Failed to sync reaction viewer state:", error)
        return
      }
    }

    const nextEntities = store.entities().map(blip => {
      if (!targetIds.includes(blip.id)) {
        return blip
      }

      const reactionsWithNextViewer = reconcileViewerReactionState({
        reactions: blip.reactions ?? [],
        previousViewer,
        nextViewer,
        ownEmojis: ownEmojisByBlipId.get(blip.id) ?? new Set<string>(),
      })

      return {
        ...blip,
        reactions: reactionsWithNextViewer,
        reactions_count: reactionsWithNextViewer.reduce(
          (total, reaction) => total + reaction.count,
          0,
        ),
        my_reaction_count: ownEmojisByBlipId.get(blip.id)?.size ?? 0,
      }
    })

    store.setInitialData(nextEntities)
  }

  const refreshReactionState = async (blipId: string) => {
    try {
      const reactionState = await getBlipReactionState(supabaseClient, blipId)
      if (!reactionState) {
        return
      }

      applyReactionState(blipId, reactionState)
    } catch (error) {
      console.error("Failed to refresh blip reaction state:", error)
    }
  }

  const refreshReactionStates = async (blipIds: string[]) => {
    const targetIds = toUniqueBlipIds(blipIds)
    if (targetIds.length === 0) {
      return
    }

    try {
      const reactionStates = await getBlipReactionStates(supabaseClient, targetIds)
      for (const blipId of targetIds) {
        const reactionState = reactionStates[blipId]
        if (!reactionState) {
          continue
        }
        applyReactionState(blipId, reactionState)
      }
    } catch (error) {
      console.error("Failed to refresh blip reaction states:", error)
    }
  }

  const updateCachedReactionState = (
    blipId: string,
    reactionState: BlipReactionState,
  ) => {
    applyReactionState(blipId, reactionState)
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
          void refreshReactionState(incoming.id)
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

  const watchBlips = (
    blipIds: string[],
    handlers: BlipWatchHandlers = {},
  ): Unsubscribe => {
    const targetIds = toUniqueBlipIds(blipIds)
    if (targetIds.length === 0) {
      return () => {}
    }

    let channel = supabaseClient.channel(`blips-watch-${targetIds.slice().sort().join("-")}`)

    for (const blipId of targetIds) {
      channel = channel.on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "blips",
          filter: `id=eq.${blipId}`,
        },
        (payload: { new: Blip }) => {
          const incoming = payload.new
          if (!incoming?.id) {
            return
          }

          void store.upsert(incoming, { cacheOnly: true })
          handlers.onUpdate?.(incoming)
        },
      )
    }

    channel.subscribe()

    return () => {
      void supabaseClient.removeChannel(channel)
    }
  }

  const watchReactions = (
    blipIds: string[],
    handlers: BlipReactionWatchHandlers = {},
  ): Unsubscribe => {
    const targetIds = toUniqueBlipIds(blipIds)
    if (targetIds.length === 0) {
      return () => {}
    }

    const pendingRefreshTimers = new Map<string, ReturnType<typeof setTimeout>>()
    const scheduleRefresh = (blipId: string) => {
      const existingTimer = pendingRefreshTimers.get(blipId)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      const timeoutId = setTimeout(() => {
        pendingRefreshTimers.delete(blipId)
        void refreshReactionState(blipId).then(() => {
          handlers.onRefresh?.(blipId)
        })
      }, 60)

      pendingRefreshTimers.set(blipId, timeoutId)
    }

    let channel = supabaseClient.channel(
      `blip-reactions-${targetIds.slice().sort().join("-")}`,
    )

    for (const blipId of targetIds) {
      channel = channel
        .on(
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "reactions",
            filter: `blip_id=eq.${blipId}`,
          },
          () => {
            scheduleRefresh(blipId)
          },
        )
        .on(
          "postgres_changes" as any,
          {
            event: "DELETE",
            schema: "public",
            table: "reactions",
            filter: `blip_id=eq.${blipId}`,
          },
          () => {
            scheduleRefresh(blipId)
          },
        )
    }

    channel.subscribe()

    return () => {
      for (const timeoutId of pendingRefreshTimers.values()) {
        clearTimeout(timeoutId)
      }
      pendingRefreshTimers.clear()
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
      reactions_count: existingBlip.reactions_count,
      my_reaction_count: existingBlip.my_reaction_count,
      reactions: existingBlip.reactions,
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
    watchBlips,
    watchUpdates,
    watchReactions,
    refreshReactionState,
    refreshReactionStates,
    updateCachedReactionState,
    syncReactionViewer,
    publish: publishWithPreservedFields,
    unpublish: unpublishWithPreservedFields,
  }
}
