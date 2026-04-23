import type { Blip } from "@/modules/blips/data/schema"
import { compareBlipsByPublishTimestampDesc } from "@/modules/blips/util"

export type TopLevelSortDirection = "asc" | "desc"

export type TopLevelActivityItem = {
  kind: "comment" | "update"
  blip: Blip
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

  activity.sort((left, right) =>
    compareBlipsByPublishTimestampDesc(left.blip, right.blip),
  )

  if (params.direction === "asc") {
    activity.reverse()
  }

  return activity
}
