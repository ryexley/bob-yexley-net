import { describe, expect, it } from "vitest"
import { BLIP_TYPES } from "@/modules/blips/data/schema"
import {
  buildBlipReactionStates,
  isMissingSlugColumnError,
  mapViewUpdateRows,
  selectWithSlugFallback,
} from "@/modules/blips/data/queries"

describe("blip queries", () => {
  it("maps nested update reactions from view_blips graph rows", () => {
    const updates = mapViewUpdateRows([
      {
        id: "update-1",
        parent_id: "root-1",
        user_id: "user-1",
        title: null,
        content: "Update",
        published: true,
        moderation_status: "approved",
        created_at: "2026-03-28T12:00:00.000Z",
        updated_at: "2026-03-28T12:00:00.000Z",
        blip_type: BLIP_TYPES.UPDATE,
        reactions_count: 2,
        my_reaction_count: 1,
        reactions: [
          {
            emoji: "🔥",
            count: 2,
            reacted_by_current_user: true,
            display_names: ["Bob", "Sue"],
          },
        ],
      },
    ])

    expect(updates).toEqual([
      expect.objectContaining({
        id: "update-1",
        reactions_count: 2,
        my_reaction_count: 1,
        reactions: [
          {
            emoji: "🔥",
            count: 2,
            reacted_by_current_user: true,
            display_names: ["Bob", "Sue"],
          },
        ],
      }),
    ])
  })

  it("builds reaction states for arbitrary blip ids including comments", () => {
    const states = buildBlipReactionStates(
      ["root-1", "update-1", "update-2", "comment-1"],
      [
        {
          blip_id: "update-1",
          emoji: "🔥",
          user_id: "user-1",
          display_name: "Bob",
        },
        {
          blip_id: "update-1",
          emoji: "🔥",
          user_id: "user-2",
          display_name: "Sue",
        },
        {
          blip_id: "update-2",
          emoji: "👍",
          user_id: "user-3",
          display_name: "Pat",
        },
        {
          blip_id: "comment-1",
          emoji: "⚡",
          user_id: "user-1",
          display_name: "Bob",
        },
      ],
      "user-1",
    )

    expect(states["root-1"]).toEqual({
      reactions_count: 0,
      my_reaction_count: 0,
      reactions: [],
    })
    expect(states["update-1"]).toEqual({
      reactions_count: 2,
      my_reaction_count: 1,
      reactions: [
        {
          emoji: "🔥",
          count: 2,
          reacted_by_current_user: true,
          display_names: ["Bob", "Sue"],
        },
      ],
    })
    expect(states["update-2"]).toEqual({
      reactions_count: 1,
      my_reaction_count: 0,
      reactions: [
        {
          emoji: "👍",
          count: 1,
          reacted_by_current_user: false,
          display_names: ["Pat"],
        },
      ],
    })
    expect(states["comment-1"]).toEqual({
      reactions_count: 1,
      my_reaction_count: 1,
      reactions: [
        {
          emoji: "⚡",
          count: 1,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ],
    })
  })
})

describe("view_blips slug column fallback", () => {
  it("recognizes a missing slug column error", () => {
    expect(
      isMissingSlugColumnError({ code: "42703", message: "column view_blips.slug does not exist" }),
    ).toBe(true)
    expect(isMissingSlugColumnError({ code: "42703", message: "column foo does not exist" })).toBe(
      false,
    )
    expect(isMissingSlugColumnError({ code: "PGRST116", message: "slug" })).toBe(false)
    expect(isMissingSlugColumnError(null)).toBe(false)
  })

  it("retries once without slug when the column is missing", async () => {
    const calls: string[] = []
    const result = await selectWithSlugFallback("id, title, slug, tags", async select => {
      calls.push(select)
      return calls.length === 1
        ? { data: null, error: { code: "42703", message: "column view_blips.slug does not exist" } }
        : { data: [{ id: "1" }], error: null }
    })
    expect(calls).toEqual(["id, title, slug, tags", "id, title, tags"])
    expect(result.data).toEqual([{ id: "1" }])
  })

  it("does not retry on success or unrelated errors", async () => {
    let count = 0
    await selectWithSlugFallback("id, slug", async () => {
      count += 1
      return { data: null, error: { code: "500", message: "boom" } }
    })
    expect(count).toBe(1)
  })
})
