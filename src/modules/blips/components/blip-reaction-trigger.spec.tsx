import { fireEvent, render, screen } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BlipReactionTrigger } from "@/modules/blips/components/blip-reaction-trigger"

const notifyInfo = vi.fn()
const notifyError = vi.fn()
const visitorAuthOpen = vi.fn()
const toggleReaction = vi.fn()

vi.mock("@/components/notification", () => ({
  useNotify: () => ({
    info: notifyInfo,
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

vi.mock("@/modules/auth/components/visitor-auth-modal", () => ({
  useVisitorAuth: () => ({
    open: visitorAuthOpen,
  }),
}))

vi.mock("@/modules/blips/data", () => ({
  MAX_REACTIONS_PER_BLIP: 3,
  reactionStore: () => ({
    toggleReaction,
  }),
}))

vi.mock("@/modules/blips/components/reaction-picker", () => ({
  ReactionPicker: (props: any) => (
    <button
      type="button"
      aria-label={props.triggerAriaLabel}
      data-limit-reached={props.limitReached ? "true" : "false"}
      onClick={event => props.onTriggerClick(event)}>
      trigger
    </button>
  ),
}))

vi.mock("@/i18n", () => ({
  ptr: () => (key: string) => key,
}))

describe("BlipReactionTrigger", () => {
  beforeEach(() => {
    notifyInfo.mockReset()
    notifyError.mockReset()
    visitorAuthOpen.mockReset()
    toggleReaction.mockReset()
  })

  it("shows a notification when the reaction limit is tapped", async () => {
    render(() => (
      <BlipReactionTrigger
        blip={{
          id: "blip-1",
          reactions: [
            { emoji: "👍", count: 1, reacted_by_current_user: true, display_names: ["Bob"] },
            { emoji: "❤️", count: 1, reacted_by_current_user: true, display_names: ["Bob"] },
            { emoji: "🔥", count: 1, reacted_by_current_user: true, display_names: ["Bob"] },
          ],
          my_reaction_count: 3,
          reactions_count: 3,
        }}
        triggerAriaLabel="Add reaction"
      />
    ))

    const trigger = screen.getByRole("button", { name: "Add reaction" })
    expect(trigger.getAttribute("data-limit-reached")).toBe("true")

    await fireEvent.click(trigger)

    expect(notifyInfo).toHaveBeenCalledWith({
      content: "tooltips.limitReached",
    })
  })
})
