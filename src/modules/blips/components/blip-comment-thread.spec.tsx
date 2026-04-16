import { render, screen } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BlipCommentListItem } from "@/modules/blips/components/blip-comment-thread"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"

const authState = {
  isAuthenticated: true,
  isAdmin: false,
  isSuperuser: false,
  userId: "user-1",
}

const openEditComment = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const updateCachedReactionState = vi.fn()
const toggleReaction = vi.fn()

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: () => authState.isAuthenticated,
    isAdmin: () => authState.isAdmin,
    isSuperuser: () => authState.isSuperuser,
    user: () => ({ id: authState.userId }),
    userProfile: () => ({
      id: "profile-1",
      displayName: "Bob",
      avatarSeed: "seed-1",
      avatarVersion: 1,
    }),
    userSystem: () => ({
      status: "active",
    }),
  }),
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({
    client: {},
  }),
}))

vi.mock("@/components/notification", () => ({
  useNotify: () => ({
    error: vi.fn(),
  }),
}))

vi.mock("@/components/confirm-dialog", () => ({
  useConfirm: () => vi.fn(),
}))

vi.mock("@/modules/auth/components/requires-role", () => ({
  RequiresAdmin: (props: any) =>
    authState.isAdmin || authState.isSuperuser ? props.children : null,
}))

vi.mock("@/modules/blips/context/blip-composer-context", () => ({
  useBlipComposer: () => ({
    openEditComment,
    registerCommentInlineMount: vi.fn(),
    isCommentOpenFor: () => false,
  }),
}))

vi.mock("@/modules/blips/data/store", () => ({
  blipStore: () => ({
    update,
    remove,
    upsert: vi.fn(),
    updateCachedReactionState,
  }),
}))

vi.mock("@/modules/blips/data/reactions-store", () => ({
  reactionStore: () => ({
    toggleReaction,
  }),
}))

vi.mock("@/components/tooltip", () => ({
  Tooltip: (props: any) => <>{props.children}</>,
}))

vi.mock("@/components/markdown/renderer", () => ({
  MarkdownRenderer: (props: { content: string }) => <div>{props.content}</div>,
}))

vi.mock("@/modules/blips/components/blip-reaction-summary", () => ({
  BlipReactionSummary: () => <div data-testid="reaction-summary" />,
}))

vi.mock("@/modules/blips/components/blip-reaction-trigger", () => ({
  BlipReactionTrigger: (props: any) => (
    <button type="button" aria-label={props.triggerAriaLabel}>
      add reaction
    </button>
  ),
}))

vi.mock("@/modules/users/components/user-avatar", () => ({
  UserAvatar: () => <div data-testid="user-avatar" />,
}))

vi.mock("@/modules/blips/util", () => ({
  formatBlipTimestamp: () => "2 weeks ago",
}))

vi.mock("@/i18n", () => ({
  ptr: () => (key: string) => key,
}))

const makeBlip = (overrides: Partial<Blip> = {}): Blip => ({
  id: "comment-1",
  title: null,
  content: "Comment body",
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
  author: {
    profile_id: "profile-1",
    display_name: "Author",
    avatar_seed: "seed-1",
    avatar_version: 1,
  },
  created_at: "2026-04-20T12:00:00.000Z",
  updated_at: "2026-04-20T12:00:00.000Z",
  ...overrides,
})

const makeParent = (overrides: Partial<Blip> = {}): Blip =>
  makeBlip({
    id: "root-1",
    parent_id: null,
    blip_type: BLIP_TYPES.ROOT,
    published: true,
    moderation_status: "approved",
    allow_comments: true,
    ...overrides,
  })

describe("BlipCommentListItem", () => {
  beforeEach(() => {
    authState.isAuthenticated = true
    authState.isAdmin = false
    authState.isSuperuser = false
    authState.userId = "user-1"

    openEditComment.mockReset()
    update.mockReset()
    remove.mockReset()
    updateCachedReactionState.mockReset()
    toggleReaction.mockReset()
  })

  it("shows edit only for the original author", () => {
    authState.userId = "author-1"

    render(() => (
      <BlipCommentListItem
        comment={makeBlip({ user_id: "author-1" })}
        parentBlip={makeParent()}
      />
    ))

    expect(screen.getByRole("button", { name: "actions.edit" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "actions.delete" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "actions.approve" })).toBeNull()
  })

  it("hides edit for a superuser who is not the author but still shows pending moderation controls", () => {
    authState.userId = "superuser-1"
    authState.isAdmin = true
    authState.isSuperuser = true

    render(() => (
      <BlipCommentListItem
        comment={makeBlip({ user_id: "author-1", moderation_status: "pending" })}
        parentBlip={makeParent()}
      />
    ))

    expect(screen.queryByRole("button", { name: "actions.edit" })).toBeNull()
    expect(screen.getByRole("button", { name: "actions.delete" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "actions.approve" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "actions.reject" })).toBeTruthy()
  })

  it("shows approve for rejected comments so admins can publish them again", () => {
    authState.userId = "superuser-1"
    authState.isAdmin = true
    authState.isSuperuser = true

    render(() => (
      <BlipCommentListItem
        comment={makeBlip({
          user_id: "author-1",
          published: false,
          moderation_status: "rejected",
        })}
        parentBlip={makeParent()}
      />
    ))

    expect(screen.queryByRole("button", { name: "actions.edit" })).toBeNull()
    expect(screen.getByRole("button", { name: "actions.approve" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "actions.reject" })).toBeNull()
    expect(screen.queryByRole("button", { name: "actions.unpublish" })).toBeNull()
  })

  it("shows unpublish for already published comments", () => {
    authState.userId = "superuser-1"
    authState.isAdmin = true
    authState.isSuperuser = true

    render(() => (
      <BlipCommentListItem
        comment={makeBlip({
          user_id: "author-1",
          published: true,
          moderation_status: "approved",
        })}
        parentBlip={makeParent()}
      />
    ))

    expect(screen.getByRole("button", { name: "actions.unpublish" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "actions.approve" })).toBeNull()
  })
})
