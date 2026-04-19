import type { Blip } from "@/modules/blips/data/schema"

export type TopLevelSortDirection = "asc" | "desc"

export type TopLevelActivityItem = {
  kind: "comment" | "update"
  blip: Blip
}

const compareBlipCreatedAtDesc = (left: Blip, right: Blip) => {
  const createdAtDelta =
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()

  if (createdAtDelta !== 0) {
    return createdAtDelta
  }

  return right.id.localeCompare(left.id)
}

export const buildTopLevelActivity = (params: {
  updates: Blip[]
  rootComments: Blip[]
  direction: TopLevelSortDirection
}): TopLevelActivityItem[] => {
  const activity = [
    ...params.rootComments.map(comment => ({
      kind: "comment" as const,
      blip: comment,
    })),
    ...params.updates.map(update => ({
      kind: "update" as const,
      blip: update,
    })),
  ]

  activity.sort((left, right) => compareBlipCreatedAtDesc(left.blip, right.blip))

  if (params.direction === "asc") {
    activity.reverse()
  }

  return activity
}
