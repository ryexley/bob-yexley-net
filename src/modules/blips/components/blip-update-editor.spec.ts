import { describe, expect, it } from "vitest"
import { resolveUpdateEditorDraft } from "@/modules/blips/components/blip-update-editor"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"

const makeUpdate = (overrides: Partial<Blip> = {}): Blip => ({
  id: "update-1",
  title: null,
  content: "Published update content",
  user_id: "user-1",
  parent_id: "root-1",
  blip_type: BLIP_TYPES.UPDATE,
  allow_comments: true,
  updates_count: 0,
  comments_count: 0,
  published: true,
  moderation_status: "approved",
  tags: [],
  reactions_count: 0,
  my_reaction_count: 0,
  reactions: [],
  created_at: "2026-04-20T12:00:00.000Z",
  updated_at: "2026-04-20T12:00:00.000Z",
  ...overrides,
})

describe("resolveUpdateEditorDraft", () => {
  it("seeds a fresh update draft when not editing", () => {
    expect(
      resolveUpdateEditorDraft({
        editingUpdateId: null,
        existingUpdate: null,
        nextNewUpdateId: "new-update-id",
      }),
    ).toEqual({
      updateId: "new-update-id",
      content: "",
      lastSavedContent: "",
      isPublished: true,
      hasPersistedCurrentUpdate: false,
    })
  })

  it("uses the existing update content when editing", () => {
    expect(
      resolveUpdateEditorDraft({
        editingUpdateId: "update-1",
        existingUpdate: makeUpdate(),
        nextNewUpdateId: "new-update-id",
      }),
    ).toEqual({
      updateId: "update-1",
      content: "Published update content",
      lastSavedContent: "Published update content",
      isPublished: true,
      hasPersistedCurrentUpdate: true,
    })
  })

  it("preserves the requested edit target id while waiting for it to load", () => {
    expect(
      resolveUpdateEditorDraft({
        editingUpdateId: "update-1",
        existingUpdate: null,
        nextNewUpdateId: "new-update-id",
      }),
    ).toEqual({
      updateId: "update-1",
      content: "",
      lastSavedContent: "",
      isPublished: true,
      hasPersistedCurrentUpdate: false,
    })
  })
})
