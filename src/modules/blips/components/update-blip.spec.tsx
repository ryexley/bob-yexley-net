import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UpdateBlip } from "@/modules/blips/components/update-blip"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"

const notifyError = vi.fn()
const toggleReaction = vi.fn()
const updateCachedReactionState = vi.fn()

vi.mock("@/components/notification", () => ({
  useNotify: () => ({
    error: notifyError,
  }),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: () => true,
    visitor: () => ({
      id: "visitor-1",
      status: "active",
      displayName: "Bob",
    }),
  }),
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({
    client: {},
  }),
}))

vi.mock("@/components/tooltip", () => ({
  Tooltip: (props: any) => <>{props.children}</>,
}))

vi.mock("@/components/markdown/renderer", () => ({
  MarkdownRenderer: (props: { content: string }) => <div>{props.content}</div>,
}))

vi.mock("@/modules/blips/components/blip-actions", () => ({
  BlipActions: () => <div data-testid="blip-actions" />,
}))

vi.mock("@/modules/blips/components/blip-reaction-trigger", () => ({
  BlipReactionTrigger: (props: any) => (
    <button type="button" aria-label={props.triggerAriaLabel}>
      add-reaction
    </button>
  ),
}))

vi.mock("@/modules/blips/data/reactions-store", () => ({
  reactionStore: () => ({
    toggleReaction,
  }),
}))

vi.mock("@/modules/blips/data/store", () => ({
  blipStore: () => ({
    updateCachedReactionState,
  }),
}))

vi.mock("@/modules/blips/util", () => ({
  formatBlipTimestamp: () => "2m ago",
}))

vi.mock("@/i18n", () => ({
  ptr: () => (key: string) => key,
}))

const makeBlip = (overrides: Partial<Blip> = {}): Blip => ({
  id: "update-1",
  title: null,
  content: "Update body",
  user_id: "user-1",
  parent_id: "root-1",
  blip_type: BLIP_TYPES.UPDATE,
  updates_count: 0,
  published: true,
  moderation_status: "approved",
  tags: [],
  reactions_count: 1,
  my_reaction_count: 1,
  reactions: [
    {
      emoji: "🔥",
      count: 1,
      reacted_by_current_user: true,
      display_names: ["Bob"],
    },
  ],
  created_at: "2026-03-28T12:00:00.000Z",
  updated_at: "2026-03-28T12:00:00.000Z",
  ...overrides,
})

describe("UpdateBlip", () => {
  beforeEach(() => {
    notifyError.mockReset()
    toggleReaction.mockReset()
    updateCachedReactionState.mockReset()
  })

  it("renders reaction summary pills and add-reaction trigger", () => {
    render(() => <UpdateBlip blip={makeBlip()} />)

    expect(screen.getByRole("button", { name: "actions.addReaction" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove 🔥 reaction" })).toBeTruthy()
  })

  it("toggles an update reaction and syncs the shared blip cache", async () => {
    toggleReaction.mockResolvedValue({
      error: null,
      data: {
        active: false,
        myReactionCount: 0,
      },
    })

    render(() => <UpdateBlip blip={makeBlip()} />)

    await fireEvent.click(screen.getByRole("button", { name: "Remove 🔥 reaction" }))

    await waitFor(() => {
      expect(toggleReaction).toHaveBeenCalledWith("update-1", "🔥", {
        visitorId: "visitor-1",
        visitorStatus: "active",
        currentCount: 1,
        hasActiveReaction: true,
      })
    })

    await waitFor(() => {
      expect(updateCachedReactionState).toHaveBeenCalled()
    })

    expect(updateCachedReactionState).toHaveBeenLastCalledWith(
      "update-1",
      expect.objectContaining({
        my_reaction_count: 0,
        reactions_count: 0,
      }),
    )
  })
})
