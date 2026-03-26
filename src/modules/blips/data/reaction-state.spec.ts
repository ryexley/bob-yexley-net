import { describe, expect, it } from "vitest"
import {
  buildNextReactionSummaries,
  sumReactionCounts,
} from "@/modules/blips/data/reaction-state"
import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"

const reactions = (items: Partial<BlipReactionSummary>[]): BlipReactionSummary[] =>
  items.map(item => ({
    emoji: item.emoji ?? "👍",
    count: item.count ?? 0,
    reacted_by_current_user: item.reacted_by_current_user ?? false,
    display_names: item.display_names ?? [],
  }))

describe("reaction-state", () => {
  it("adds a new active reaction with a normalized display name", () => {
    const next = buildNextReactionSummaries([], "🔥", true, "  Bob  ")

    expect(next).toEqual(
      reactions([
        {
          emoji: "🔥",
          count: 1,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ]),
    )
  })

  it("increments an existing reaction without duplicating display names", () => {
    const next = buildNextReactionSummaries(
      reactions([
        {
          emoji: "🔥",
          count: 2,
          reacted_by_current_user: false,
          display_names: ["Bob"],
        },
      ]),
      "🔥",
      true,
      "Bob",
    )

    expect(next).toEqual(
      reactions([
        {
          emoji: "🔥",
          count: 3,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ]),
    )
  })

  it("removes a reaction entirely when the last count is toggled off", () => {
    const next = buildNextReactionSummaries(
      reactions([
        {
          emoji: "🔥",
          count: 1,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ]),
      "🔥",
      false,
      "Bob",
    )

    expect(next).toEqual([])
  })

  it("decrements a reaction count and clears ownership when toggled off", () => {
    const next = buildNextReactionSummaries(
      reactions([
        {
          emoji: "🔥",
          count: 2,
          reacted_by_current_user: true,
          display_names: ["Bob", "Sue"],
        },
      ]),
      "🔥",
      false,
      "Bob",
    )

    expect(next).toEqual(
      reactions([
        {
          emoji: "🔥",
          count: 1,
          reacted_by_current_user: false,
          display_names: ["Sue"],
        },
      ]),
    )
  })

  it("sums reaction counts across emojis", () => {
    expect(
      sumReactionCounts(
        reactions([
          { emoji: "🔥", count: 2 },
          { emoji: "👍", count: 1 },
          { emoji: "❤️", count: 4 },
        ]),
      ),
    ).toBe(7)
  })
})
