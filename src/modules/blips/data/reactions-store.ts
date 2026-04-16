import type { SupabaseClient } from "@supabase/supabase-js"
import { supaStore, type OperationResult, type StoreOptions } from "@/lib/data/supa-store"
import { REACTION_EMOJI_SET } from "@/lib/data/reactions-emoji-set"
import { REACTION_ERROR } from "@/modules/blips/data/errors"
import type { Blip } from "@/modules/blips/data/schema"
import type { Reaction } from "@/modules/blips/data/reactions-schema"

const _reactionStore = supaStore<Reaction>("reactions")

export const MAX_REACTIONS_PER_BLIP = 3

type ReactionActionResult = {
  active: boolean
  myReactionCount: number
}

type ReactionActor = {
  profileId: string | null
  status: "pending" | "active" | "locked" | null
  currentCount: number
  hasActiveReaction: boolean
}

const normalizeEmoji = (value: string) => value.trim()

export function reactionStore(
  supabaseClient: SupabaseClient,
  options: StoreOptions = {},
) {
  const store = _reactionStore(supabaseClient, options)

  const isReactionEnabled = (emoji: string) =>
    REACTION_EMOJI_SET.includes(normalizeEmoji(emoji) as (typeof REACTION_EMOJI_SET)[number])

  const listForBlip = async (blipId: string): Promise<OperationResult<Reaction[]>> => {
    if (!blipId) {
      return { data: [], error: null }
    }

    try {
      const { data, error } = await supabaseClient
        .from("reactions")
        .select("id, blip_id, user_profile_id, emoji, created_at")
        .eq("blip_id", blipId)
        .order("created_at", { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      return { data: (data ?? []) as Reaction[], error: null }
    } catch (error) {
      console.error("Failed to load reactions:", error)
      return { data: null, error: REACTION_ERROR.UNKNOWN }
    }
  }

  const toggleReaction = async (
    blipId: string,
    emojiValue: string,
    actor: ReactionActor,
  ): Promise<OperationResult<ReactionActionResult>> => {
    if (!blipId) {
      return { data: null, error: REACTION_ERROR.BLIP_ID_REQUIRED }
    }

    const emoji = normalizeEmoji(emojiValue)
    if (!isReactionEnabled(emoji)) {
      return { data: null, error: REACTION_ERROR.INVALID_EMOJI }
    }

    if (!actor.profileId) {
      return { data: null, error: REACTION_ERROR.AUTH_REQUIRED }
    }

    if (actor.status === "locked") {
      return { data: null, error: REACTION_ERROR.VISITOR_LOCKED }
    }

    try {
      if (actor.hasActiveReaction) {
        const { error } = await supabaseClient
          .from("reactions")
          .delete()
          .eq("blip_id", blipId)
          .eq("user_profile_id", actor.profileId)
          .eq("emoji", emoji)

        if (error) {
          console.error("Failed to remove reaction:", error)
          return { data: null, error: REACTION_ERROR.UNKNOWN }
        }

        return {
          data: {
            active: false,
            myReactionCount: Math.max(actor.currentCount - 1, 0),
          },
          error: null,
        }
      }

      if (actor.currentCount >= MAX_REACTIONS_PER_BLIP) {
        return { data: null, error: REACTION_ERROR.LIMIT_REACHED }
      }

      const { error } = await supabaseClient.from("reactions").insert({
        blip_id: blipId,
        user_profile_id: actor.profileId,
        emoji,
      })

      if (error) {
        if (error.message?.includes(REACTION_ERROR.LIMIT_REACHED)) {
          return { data: null, error: REACTION_ERROR.LIMIT_REACHED }
        }

        console.error("Failed to add reaction:", error)
        return { data: null, error: REACTION_ERROR.UNKNOWN }
      }

      return {
        data: {
          active: true,
          myReactionCount: actor.currentCount + 1,
        },
        error: null,
      }
    } catch (error) {
      console.error("Failed to toggle reaction:", error)
      return { data: null, error: REACTION_ERROR.UNKNOWN }
    }
  }

  const myReactionCountForBlip = (blip: Pick<Blip, "my_reaction_count">) =>
    blip.my_reaction_count ?? 0

  const hasReachedReactionLimit = (blip: Pick<Blip, "my_reaction_count">) =>
    myReactionCountForBlip(blip) >= MAX_REACTIONS_PER_BLIP

  return {
    ...store,
    listForBlip,
    toggleReaction,
    myReactionCountForBlip,
    hasReachedReactionLimit,
    isReactionEnabled,
  }
}
