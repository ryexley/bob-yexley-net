import { describe, expect, it } from "vitest"
import {
  buildOptimisticReactionState,
  createReactionStateOverride,
  getReactionSignature,
} from "@/modules/blips/data/reaction-optimistic"

describe("reaction-optimistic", () => {
  it("creates a stable reaction signature", () => {
    expect(
      getReactionSignature([
        {
          emoji: "🔥",
          count: 2,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ]),
    ).toBe("🔥:2:1:Bob")
  })

  it("builds an optimistic add state", () => {
    expect(
      buildOptimisticReactionState({
        reactions: [],
        myReactionCount: 0,
        emoji: "🔥",
        nextActive: true,
        visitorDisplayName: "Bob",
      }),
    ).toEqual({
      reactions: [
        {
          emoji: "🔥",
          count: 1,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ],
      my_reaction_count: 1,
      reactions_count: 1,
    })
  })

  it("creates a rollback state from existing reactions", () => {
    expect(
      createReactionStateOverride(
        [
          {
            emoji: "🔥",
            count: 2,
            reacted_by_current_user: true,
            display_names: ["Bob"],
          },
        ],
        2,
      ),
    ).toEqual({
      reactions: [
        {
          emoji: "🔥",
          count: 2,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ],
      my_reaction_count: 2,
      reactions_count: 2,
    })
  })
})
