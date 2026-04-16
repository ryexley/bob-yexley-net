import { describe, expect, it } from "vitest"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"
import { buildTopLevelActivity } from "@/modules/blips/views/blip-detail-ordering"

const makeBlip = (overrides: Partial<Blip> = {}): Blip => ({
  id: "blip-1",
  title: null,
  content: "Test blip",
  user_id: "user-1",
  parent_id: null,
  blip_type: BLIP_TYPES.ROOT,
  updates_count: 0,
  published: true,
  moderation_status: "approved",
  tags: [],
  reactions_count: 0,
  my_reaction_count: 0,
  reactions: [],
  created_at: "2026-03-28T12:00:00.000Z",
  updated_at: "2026-03-28T12:00:00.000Z",
  ...overrides,
})

describe("buildTopLevelActivity", () => {
  it("mixes root comments and updates newest first by default", () => {
    const activity = buildTopLevelActivity({
      direction: "desc",
      rootComments: [
        makeBlip({
          id: "comment-1",
          parent_id: "root-1",
          blip_type: BLIP_TYPES.COMMENT,
          created_at: "2026-03-28T12:01:00.000Z",
        }),
      ],
      updates: [
        makeBlip({
          id: "update-1",
          parent_id: "root-1",
          blip_type: BLIP_TYPES.UPDATE,
          created_at: "2026-03-28T12:03:00.000Z",
        }),
        makeBlip({
          id: "update-2",
          parent_id: "root-1",
          blip_type: BLIP_TYPES.UPDATE,
          created_at: "2026-03-28T12:00:30.000Z",
        }),
      ],
    })

    expect(
      activity.map(item => ({
        id: item.blip.id,
        kind: item.kind,
      })),
    ).toEqual([
      { id: "update-1", kind: "update" },
      { id: "comment-1", kind: "comment" },
      { id: "update-2", kind: "update" },
    ])
  })

  it("reverses only the top-level activity ordering when toggled oldest first", () => {
    const activity = buildTopLevelActivity({
      direction: "asc",
      rootComments: [
        makeBlip({
          id: "comment-1",
          parent_id: "root-1",
          blip_type: BLIP_TYPES.COMMENT,
          created_at: "2026-03-28T12:01:00.000Z",
        }),
      ],
      updates: [
        makeBlip({
          id: "update-1",
          parent_id: "root-1",
          blip_type: BLIP_TYPES.UPDATE,
          created_at: "2026-03-28T12:03:00.000Z",
        }),
        makeBlip({
          id: "update-2",
          parent_id: "root-1",
          blip_type: BLIP_TYPES.UPDATE,
          created_at: "2026-03-28T12:00:30.000Z",
        }),
      ],
    })

    expect(activity.map(item => item.blip.id)).toEqual([
      "update-2",
      "comment-1",
      "update-1",
    ])
  })
})
