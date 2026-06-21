import { describe, expect, it } from "vitest"
import {
  resolveMediaTriggeredUpdatePersistPublished,
  resolveUpdateCanSave,
  resolveUpdateEditorDraft,
  resolveUpdateHasComposeDraft,
} from "@/modules/blips/components/blip-update-editor"
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

describe("resolveMediaTriggeredUpdatePersistPublished", () => {
  it("persists the first media FK stub as unpublished in the database only", () => {
    expect(
      resolveMediaTriggeredUpdatePersistPublished(false, true),
    ).toBe(false)
  })

  it("uses the editor publish intent once the update row already exists", () => {
    expect(resolveMediaTriggeredUpdatePersistPublished(true, true)).toBe(true)
    expect(resolveMediaTriggeredUpdatePersistPublished(true, false)).toBe(
      false,
    )
  })
})

describe("resolveUpdateCanSave", () => {
  it("allows save for a media-only draft once uploads have settled", () => {
    expect(
      resolveUpdateCanSave({
        open: true,
        hasSaveContext: true,
        hasPendingTextChanges: false,
        hasReadyMedia: true,
        hasPersistedCurrentUpdate: false,
      }),
    ).toBe(true)
  })

  it("blocks save while media is still uploading on a new update", () => {
    expect(
      resolveUpdateCanSave({
        open: true,
        hasSaveContext: true,
        hasPendingTextChanges: false,
        hasReadyMedia: false,
        hasPersistedCurrentUpdate: false,
      }),
    ).toBe(false)
  })

  it("does not re-offer save after a media-only update was already saved", () => {
    expect(
      resolveUpdateCanSave({
        open: true,
        hasSaveContext: true,
        hasPendingTextChanges: false,
        hasReadyMedia: true,
        hasPersistedCurrentUpdate: true,
      }),
    ).toBe(false)
  })
})

describe("resolveUpdateHasComposeDraft", () => {
  it("treats ready media without text as a draft", () => {
    expect(
      resolveUpdateHasComposeDraft({
        hasText: false,
        hasMedia: true,
      }),
    ).toBe(true)
  })
})
