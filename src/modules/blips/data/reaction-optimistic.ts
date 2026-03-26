import {
  buildNextReactionSummaries,
  sumReactionCounts,
} from "@/modules/blips/data/reaction-state"
import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"

export type ReactionStateOverride = {
  reactions: BlipReactionSummary[]
  my_reaction_count: number
  reactions_count: number
}

export const getReactionSignature = (reactions: BlipReactionSummary[] = []) =>
  reactions
    .map(reaction =>
      [
        reaction.emoji,
        reaction.count,
        reaction.reacted_by_current_user ? "1" : "0",
        reaction.display_names.join(","),
      ].join(":"),
    )
    .join("|")

export const createReactionStateOverride = (
  reactions: BlipReactionSummary[],
  myReactionCount: number,
): ReactionStateOverride => ({
  reactions,
  my_reaction_count: myReactionCount,
  reactions_count: sumReactionCounts(reactions),
})

export const buildOptimisticReactionState = ({
  reactions,
  myReactionCount,
  emoji,
  nextActive,
  visitorDisplayName,
}: {
  reactions: BlipReactionSummary[]
  myReactionCount: number
  emoji: string
  nextActive: boolean
  visitorDisplayName: string | null
}): ReactionStateOverride =>
  createReactionStateOverride(
    buildNextReactionSummaries(reactions, emoji, nextActive, visitorDisplayName),
    nextActive ? myReactionCount + 1 : Math.max(myReactionCount - 1, 0),
  )
