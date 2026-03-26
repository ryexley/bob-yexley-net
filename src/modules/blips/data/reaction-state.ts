import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"

const normalizeDisplayNames = (names: string[]) =>
  [...new Set(names.map(name => name.trim()).filter(Boolean))]

const sortReactionSummaries = (reactions: BlipReactionSummary[]) =>
  [...reactions].sort((left, right) => left.emoji.localeCompare(right.emoji))

export const sumReactionCounts = (reactions: BlipReactionSummary[]) =>
  reactions.reduce((total, reaction) => total + reaction.count, 0)

export const buildNextReactionSummaries = (
  current: BlipReactionSummary[],
  emoji: string,
  nextActive: boolean,
  visitorDisplayName: string | null,
) => {
  const next = [...current]
  const targetIndex = next.findIndex(reaction => reaction.emoji === emoji)
  const displayName = visitorDisplayName?.trim() ?? ""

  if (nextActive) {
    if (targetIndex >= 0) {
      const target = next[targetIndex]
      next[targetIndex] = {
        ...target,
        count: target.count + 1,
        reacted_by_current_user: true,
        display_names: normalizeDisplayNames([...target.display_names, displayName]),
      }
      return sortReactionSummaries(next)
    }

    return sortReactionSummaries([
      ...next,
      {
        emoji,
        count: 1,
        reacted_by_current_user: true,
        display_names: normalizeDisplayNames(displayName ? [displayName] : []),
      },
    ])
  }

  if (targetIndex < 0) {
    return sortReactionSummaries(next)
  }

  const target = next[targetIndex]
  const nextCount = Math.max(target.count - 1, 0)
  if (nextCount === 0) {
    next.splice(targetIndex, 1)
    return sortReactionSummaries(next)
  }

  next[targetIndex] = {
    ...target,
    count: nextCount,
    reacted_by_current_user: false,
    display_names: displayName
      ? target.display_names.filter(name => name !== displayName)
      : target.display_names,
  }
  return sortReactionSummaries(next)
}
