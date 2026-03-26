import { fireEvent, render, screen } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { BlipReactionSummary } from "@/modules/blips/components/blip-reaction-summary"

vi.mock("@/components/tooltip", () => ({
  Tooltip: (props: { children: unknown }) => props.children,
}))

describe("BlipReactionSummary", () => {
  it("renders passive reaction pills when toggling is unavailable", () => {
    render(() => (
      <BlipReactionSummary
        reactions={[
          {
            emoji: "🔥",
            count: 2,
            reacted_by_current_user: false,
            display_names: ["Bob", "Sue"],
          },
        ]}
      />
    ))

    expect(screen.getByText("🔥")).toBeTruthy()
    expect(screen.getByText("2")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("renders the current user's reaction pill as a removable button", async () => {
    const onToggleReaction = vi.fn()

    render(() => (
      <BlipReactionSummary
        reactions={[
          {
            emoji: "❤️",
            count: 1,
            reacted_by_current_user: true,
            display_names: ["Bob"],
          },
        ]}
        onToggleReaction={onToggleReaction}
      />
    ))

    const button = screen.getByRole("button", { name: "Remove ❤️ reaction" })
    await fireEvent.click(button)

    expect(onToggleReaction).toHaveBeenCalledWith("❤️")
  })

  it("renders another user's reaction pill as an add button when toggling is available", async () => {
    const onToggleReaction = vi.fn()

    render(() => (
      <BlipReactionSummary
        reactions={[
          {
            emoji: "🔥",
            count: 2,
            reacted_by_current_user: false,
            display_names: ["Bob", "Sue"],
          },
        ]}
        onToggleReaction={onToggleReaction}
      />
    ))

    const button = screen.getByRole("button", { name: "Add 🔥 reaction" })
    await fireEvent.click(button)

    expect(onToggleReaction).toHaveBeenCalledWith("🔥")
  })

  it("disables removable pills while busy", () => {
    render(() => (
      <BlipReactionSummary
        reactions={[
          {
            emoji: "⚡",
            count: 3,
            reacted_by_current_user: true,
            display_names: ["Bob"],
          },
        ]}
        busy
        onToggleReaction={() => {}}
      />
    ))

    expect(
      screen.getByRole("button", { name: "Remove ⚡ reaction" }).hasAttribute(
        "disabled",
      ),
    ).toBe(true)
  })
})
