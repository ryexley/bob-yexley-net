import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"

export type ReactionViewer = {
  id: string | null
  status: "pending" | "active" | "locked" | null
  displayName: string | null
}

export const sortReactionSummaries = (reactions: BlipReactionSummary[]) =>
  [...reactions].sort((left, right) => left.emoji.localeCompare(right.emoji))

export const removePreviousViewerReactionState = (
  reactions: BlipReactionSummary[],
  previousViewer: ReactionViewer | null,
) => {
  if (!previousViewer?.id) {
    return reactions
  }

  return reactions
    .map(reaction => {
      if (!reaction.reacted_by_current_user) {
        return reaction
      }

      if (previousViewer.status === "active") {
        return {
          ...reaction,
          reacted_by_current_user: false,
        }
      }

      const nextCount = Math.max(reaction.count - 1, 0)
      if (nextCount === 0) {
        return null
      }

      return {
        ...reaction,
        count: nextCount,
        reacted_by_current_user: false,
        display_names: previousViewer.displayName
          ? reaction.display_names.filter(name => name !== previousViewer.displayName)
          : reaction.display_names,
      }
    })
    .filter((reaction): reaction is BlipReactionSummary => reaction !== null)
}

export const applyNextViewerReactionState = (
  reactions: BlipReactionSummary[],
  nextViewer: ReactionViewer | null,
  ownEmojis: Set<string>,
) => {
  if (!nextViewer?.id || ownEmojis.size === 0) {
    return reactions
  }

  const next = [...reactions]
  for (const emoji of ownEmojis) {
    const reactionIndex = next.findIndex(reaction => reaction.emoji === emoji)
    if (reactionIndex >= 0) {
      const reaction = next[reactionIndex]
      next[reactionIndex] = {
        ...reaction,
        count:
          reaction.reacted_by_current_user || nextViewer.status === "active"
            ? reaction.count
            : reaction.count + 1,
        reacted_by_current_user: true,
        display_names:
          nextViewer.displayName &&
          !reaction.display_names.includes(nextViewer.displayName)
            ? [...reaction.display_names, nextViewer.displayName].sort()
            : reaction.display_names,
      }
      continue
    }

    next.push({
      emoji,
      count: 1,
      reacted_by_current_user: true,
      display_names: nextViewer.displayName ? [nextViewer.displayName] : [],
    })
  }

  return sortReactionSummaries(next)
}

export const reconcileViewerReactionState = ({
  reactions,
  previousViewer,
  nextViewer,
  ownEmojis,
}: {
  reactions: BlipReactionSummary[]
  previousViewer: ReactionViewer | null
  nextViewer: ReactionViewer | null
  ownEmojis: Set<string>
}) =>
  applyNextViewerReactionState(
    removePreviousViewerReactionState(reactions, previousViewer),
    nextViewer,
    ownEmojis,
  )
