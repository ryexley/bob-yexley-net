import { describe, expect, it } from "vitest"
import { resolveCommentEditorDraft } from "@/modules/blips/components/blip-comment-editor"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"

const makeComment = (overrides: Partial<Blip> = {}): Blip => ({
  id: "comment-1",
  title: null,
  content: "Existing comment",
  user_id: "user-1",
  parent_id: "root-1",
  blip_type: BLIP_TYPES.COMMENT,
  allow_comments: false,
  updates_count: 0,
  comments_count: 0,
  published: false,
  moderation_status: "pending",
  tags: [],
  reactions_count: 0,
  my_reaction_count: 0,
  reactions: [],
  created_at: "2026-04-20T12:00:00.000Z",
  updated_at: "2026-04-20T12:00:00.000Z",
  ...overrides,
})

describe("resolveCommentEditorDraft", () => {
  it("seeds a new comment draft when not editing", () => {
    expect(
      resolveCommentEditorDraft({
        editingCommentId: null,
        existingComment: null,
        nextNewCommentId: "new-comment-id",
      }),
    ).toEqual({
      commentId: "new-comment-id",
      content: "",
    })
  })

  it("uses the existing comment content when editing", () => {
    expect(
      resolveCommentEditorDraft({
        editingCommentId: "comment-1",
        existingComment: makeComment(),
        nextNewCommentId: "new-comment-id",
      }),
    ).toEqual({
      commentId: "comment-1",
      content: "Existing comment",
    })
  })

  it("preserves the requested edit target id while waiting for it to load", () => {
    expect(
      resolveCommentEditorDraft({
        editingCommentId: "comment-1",
        existingComment: null,
        nextNewCommentId: "new-comment-id",
      }),
    ).toEqual({
      commentId: "comment-1",
      content: "",
    })
  })
})
