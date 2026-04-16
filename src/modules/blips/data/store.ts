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
type RealtimeChannelLike = {
  unsubscribe?: () => Promise<unknown> | unknown
}
const activeScopedChannels = new Map<string, RealtimeChannelLike>()

const removeRealtimeChannelSafely = async (
  supabaseClient: SupabaseClient,
  channel: RealtimeChannelLike | null | undefined,
) => {
  if (!channel) {
    return
  }

  try {
    await channel.unsubscribe?.()
  } catch {}

  try {
    await supabaseClient.removeChannel(channel as any)
  } catch {}
}

export type BlipUpdateWatchHandlers = {
  onInsert?: (blip: Blip) => void
  onUpdate?: (blip: Blip) => void
  onDelete?: (blipId: string) => void
}

export type BlipCommentWatchHandlers = {
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
  const entitiesById = createMemo(() => {
    const byId = new Map<string, Blip>()
    for (const entity of store.entities()) {
      byId.set(entity.id, entity)
    }
    return byId
  })
  const updatesByParentMap = createMemo(() => {
    const byParent = new Map<string, Blip[]>()

    for (const blip of store.entities()) {
      if (blip.blip_type !== BLIP_TYPES.UPDATE || !blip.parent_id) {
        continue
      }

      const existing = byParent.get(blip.parent_id)
      if (existing) {
        existing.push(blip)
      } else {
        byParent.set(blip.parent_id, [blip])
      }
    }

    for (const updates of byParent.values()) {
      updates.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }

    return byParent
  })
  const commentsByParentMap = createMemo(() => {
    const byParent = new Map<string, Blip[]>()

    for (const blip of store.entities()) {
      if (blip.blip_type !== BLIP_TYPES.COMMENT || !blip.parent_id) {
        continue
      }

      const existing = byParent.get(blip.parent_id)
      if (existing) {
        existing.push(blip)
      } else {
        byParent.set(blip.parent_id, [blip])
      }
    }

    for (const comments of byParent.values()) {
      comments.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }

    return byParent
  })

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

    return updatesByParentMap().get(parentId) ?? []
  }

  const getById = (blipId?: string | null) => {
    if (!blipId) {
      return null
    }

    return entitiesById().get(blipId) ?? null
  }

  const commentsByParent = (parentId?: string | null): Blip[] => {
    if (!parentId) {
      return []
    }

    return commentsByParentMap().get(parentId) ?? []
  }

  const loadCommentAuthor = async (
    userId?: string | null,
  ): Promise<Blip["author"] | undefined> => {
    if (!userId) {
      return undefined
    }

    const { data, error } = await supabaseClient
      .from("view_public_user")
      .select("profile_id, display_name, avatar_seed, avatar_version")
      .eq("user_id", userId)
      .maybeSingle()

    if (error || !data) {
      return undefined
    }

    return {
      profile_id: data.profile_id ?? null,
      display_name: data.display_name ?? null,
      avatar_seed: data.avatar_seed ?? null,
      avatar_version:
        typeof data.avatar_version === "number" ? data.avatar_version : null,
    }
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

  const replaceCommentsForParents = (
    parentIds: string[],
    comments: Blip[],
  ) => {
    const targetParentIds = new Set(toUniqueBlipIds(parentIds))
    if (targetParentIds.size === 0) {
      return
    }

    const nextComments = comments.filter(
      comment =>
        comment.blip_type === BLIP_TYPES.COMMENT &&
        Boolean(comment.parent_id) &&
        targetParentIds.has(comment.parent_id),
    )

    const nextEntities = [
      ...store.entities().filter(
        blip =>
          blip.blip_type !== BLIP_TYPES.COMMENT ||
          !blip.parent_id ||
          !targetParentIds.has(blip.parent_id),
      ),
      ...nextComments,
    ]

    store.setInitialData(nextEntities)
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
    const targetIdSet = new Set(targetIds)

    const ownEmojisByBlipId = new Map<string, Set<string>>()
    if (nextViewer?.id) {
      try {
        const { data, error } = await supabaseClient
          .from("reactions")
          .select("blip_id, emoji")
          .eq("user_profile_id", nextViewer.id)
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

    let didChange = false
    const nextEntities = store.entities().map(blip => {
      if (!targetIdSet.has(blip.id)) {
        return blip
      }

      const ownEmojis = ownEmojisByBlipId.get(blip.id) ?? new Set<string>()
      const reactionsWithNextViewer = reconcileViewerReactionState({
        reactions: blip.reactions ?? [],
        previousViewer,
        nextViewer,
        ownEmojis,
      })
      const nextReactionsCount = reactionsWithNextViewer.reduce(
        (total, reaction) => total + reaction.count,
        0,
      )
      const nextMyReactionCount = ownEmojis.size
      const currentReactions = JSON.stringify(blip.reactions ?? [])
      const nextReactions = JSON.stringify(reactionsWithNextViewer)

      if (
        currentReactions === nextReactions &&
        (blip.reactions_count ?? 0) === nextReactionsCount &&
        (blip.my_reaction_count ?? 0) === nextMyReactionCount
      ) {
        return blip
      }

      didChange = true
      return {
        ...blip,
        reactions: reactionsWithNextViewer,
        reactions_count: nextReactionsCount,
        my_reaction_count: nextMyReactionCount,
      }
    })

    if (!didChange) {
      return
    }

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

    const channelKey = `blip-updates-${parentId}`
    const existingChannel = activeScopedChannels.get(channelKey)
    if (existingChannel) {
      void removeRealtimeChannelSafely(supabaseClient, existingChannel)
    }

    const channel = supabaseClient
      .channel(channelKey)
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

    activeScopedChannels.set(channelKey, channel)

    return () => {
      if (activeScopedChannels.get(channelKey) === channel) {
        activeScopedChannels.delete(channelKey)
      }
      void removeRealtimeChannelSafely(supabaseClient, channel)
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

    const channelKey = `blips-watch-${targetIds.slice().sort().join("-")}`
    const existingChannel = activeScopedChannels.get(channelKey)
    if (existingChannel) {
      void removeRealtimeChannelSafely(supabaseClient, existingChannel)
    }

    let channel = supabaseClient.channel(channelKey)

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
    activeScopedChannels.set(channelKey, channel)

    return () => {
      if (activeScopedChannels.get(channelKey) === channel) {
        activeScopedChannels.delete(channelKey)
      }
      void removeRealtimeChannelSafely(supabaseClient, channel)
    }
  }

  const watchComments = (
    parentIds: string[],
    handlers: BlipCommentWatchHandlers = {},
  ): Unsubscribe => {
    const targetIds = toUniqueBlipIds(parentIds)
    if (targetIds.length === 0) {
      return () => {}
    }

    const targetSet = new Set(targetIds)
    const channelKey = `blip-comments-${targetIds.slice().sort().join("-")}`
    const existingChannel = activeScopedChannels.get(channelKey)
    if (existingChannel) {
      void removeRealtimeChannelSafely(supabaseClient, existingChannel)
    }

    const handleIncomingUpsert = async (
      incoming: Blip,
      onChange?: (blip: Blip) => void,
    ) => {
      if (
        incoming.blip_type !== BLIP_TYPES.COMMENT ||
        !incoming.parent_id ||
        !targetSet.has(incoming.parent_id)
      ) {
        return
      }

      const nextComment = {
        ...incoming,
        author: incoming.author ?? (await loadCommentAuthor(incoming.user_id)),
      }

      void store.upsert(nextComment, { cacheOnly: true })
      onChange?.(nextComment)
    }

    const channel = supabaseClient
      .channel(channelKey)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "blips",
          filter: "blip_type=eq.comment",
        },
        (payload: { new: Blip }) => {
          void handleIncomingUpsert(payload.new, handlers.onInsert)
        },
      )
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "blips",
          filter: "blip_type=eq.comment",
        },
        (payload: { new: Blip }) => {
          void handleIncomingUpsert(payload.new, handlers.onUpdate)
        },
      )
      .on(
        "postgres_changes" as any,
        {
          event: "DELETE",
          schema: "public",
          table: "blips",
          filter: "blip_type=eq.comment",
        },
        (payload: { old: { id: string } }) => {
          const deletedId = payload.old.id
          if (!deletedId) {
            return
          }

          const existing = store.entities().find(blip => blip.id === deletedId)
          if (
            !existing ||
            existing.blip_type !== BLIP_TYPES.COMMENT ||
            !existing.parent_id ||
            !targetSet.has(existing.parent_id)
          ) {
            return
          }

          removeFromCache(deletedId)
          handlers.onDelete?.(deletedId)
        },
      )
      .subscribe()

    activeScopedChannels.set(channelKey, channel)

    return () => {
      if (activeScopedChannels.get(channelKey) === channel) {
        activeScopedChannels.delete(channelKey)
      }
      void removeRealtimeChannelSafely(supabaseClient, channel)
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

    const channelKey = `blip-reactions-${targetIds.slice().sort().join("-")}`
    const existingChannel = activeScopedChannels.get(channelKey)
    if (existingChannel) {
      void removeRealtimeChannelSafely(supabaseClient, existingChannel)
    }

    let channel = supabaseClient.channel(channelKey)

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
    activeScopedChannels.set(channelKey, channel)

    return () => {
      for (const timeoutId of pendingRefreshTimers.values()) {
        clearTimeout(timeoutId)
      }
      pendingRefreshTimers.clear()
      if (activeScopedChannels.get(channelKey) === channel) {
        activeScopedChannels.delete(channelKey)
      }
      void removeRealtimeChannelSafely(supabaseClient, channel)
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
      allow_comments: existingBlip.allow_comments,
      tags: fallbackTags ?? [],
      updates_count: existingBlip.updates_count,
      reactions_count: existingBlip.reactions_count,
      my_reaction_count: existingBlip.my_reaction_count,
      reactions: existingBlip.reactions,
      author: existingBlip.author,
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
    commentsByParent,
    getById,
    mergeIntoCache,
    removeFromCache,
    replaceCommentsForParents,
    watchBlips,
    watchUpdates,
    watchComments,
    watchReactions,
    refreshReactionState,
    refreshReactionStates,
    updateCachedReactionState,
    syncReactionViewer,
    publish: publishWithPreservedFields,
    unpublish: unpublishWithPreservedFields,
  }
}
