import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BlipReactionSummary } from "@/modules/blips/components/blip-reaction-summary"

const {
  isAuthenticated,
  viewportWidth,
} = vi.hoisted(() => ({
  isAuthenticated: vi.fn(() => true),
  viewportWidth: vi.fn(() => 1024),
}))

vi.mock("@/components/tooltip", () => ({
  Tooltip: (props: {
    children: any
    content: any
    disabled?: boolean
    triggerAs?: "button" | "span"
    triggerClass?: string
    triggerProps?: Record<string, unknown>
  }) => {
    if (props.disabled) {
      return props.children
    }

    if (props.triggerAs === "button") {
      return (
        <>
          <button class={`tooltip-trigger ${props.triggerClass ?? ""}`} {...props.triggerProps}>
            {props.children}
          </button>
          <div role="tooltip">{props.content}</div>
        </>
      )
    }

    return (
      <>
        <span class={`tooltip-trigger ${props.triggerClass ?? ""}`}>{props.children}</span>
        <div role="tooltip">{props.content}</div>
      </>
    )
  },
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated,
  }),
}))

vi.mock("@/context/viewport", () => ({
  useViewport: () => ({
    width: viewportWidth,
  }),
}))

describe("BlipReactionSummary", () => {
  beforeEach(() => {
    isAuthenticated.mockReset()
    isAuthenticated.mockReturnValue(true)
    viewportWidth.mockReset()
    viewportWidth.mockReturnValue(1024)
  })

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

    expect(screen.getAllByText("🔥").length).toBeGreaterThan(0)
    expect(screen.getByText("2")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("renders desktop tooltip content on the real button trigger", () => {
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
        onToggleReaction={() => {}}
      />
    ))

    return waitFor(() => {
      const button = screen.getByRole("button", { name: "Add 🔥 reaction" })
      expect(button.className).toContain("tooltip-trigger")

      const tooltip = screen.getByRole("tooltip")
      expect(within(tooltip).getByText("Bob, Sue")).toBeTruthy()
      expect(within(tooltip).getByText("🔥")).toBeTruthy()
      expect(screen.queryByRole("dialog", { name: "Reactions for 🔥" })).toBeNull()
    })
  })

  it("does not render desktop tooltip content on mobile", () => {
    viewportWidth.mockReturnValue(390)

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
        onToggleReaction={() => {}}
      />
    ))

    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  it("does not expose reactor names to unauthenticated users", () => {
    isAuthenticated.mockReturnValue(false)

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

    expect(screen.queryByText("Bob, Sue")).toBeNull()
  })

  it("reactively enables desktop tooltip content when auth becomes ready", async () => {
    const [authenticated, setAuthenticated] = createSignal(false)
    isAuthenticated.mockImplementation(() => authenticated())

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
        onToggleReaction={() => {}}
      />
    ))

    expect(screen.queryByRole("tooltip")).toBeNull()

    setAuthenticated(true)

    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Add 🔥 reaction" })
      expect(button.className).toContain("tooltip-trigger")
      expect(within(screen.getByRole("tooltip")).getByText("Bob, Sue")).toBeTruthy()
    })
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

  it("shows mobile reaction names in an overlay on long-press fallback", async () => {
    viewportWidth.mockReturnValue(390)

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
        onToggleReaction={() => {}}
      />
    ))

    expect(screen.getAllByRole("button", { name: "Add 🔥 reaction" })).toHaveLength(1)

    const button = screen.getByRole("button", { name: "Add 🔥 reaction" })
    await waitFor(async () => {
      await fireEvent.contextMenu(button)
      expect(screen.getByRole("dialog", { name: "Reactions for 🔥" })).toBeTruthy()
    })

    const dialog = screen.getByRole("dialog", { name: "Reactions for 🔥" })
    expect(within(dialog).getByText("Bob, Sue")).toBeTruthy()
    expect(within(dialog).getByText("🔥")).toBeTruthy()
    expect(screen.queryByRole("tooltip")).toBeNull()
    expect(screen.getAllByRole("button", { name: "Add 🔥 reaction" })).toHaveLength(1)
  })

  it("does not open the mobile popover for unauthenticated users", async () => {
    isAuthenticated.mockReturnValue(false)
    viewportWidth.mockReturnValue(390)

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
        onToggleReaction={() => {}}
      />
    ))

    const button = screen.getByRole("button", { name: "Add 🔥 reaction" })
    await fireEvent.contextMenu(button)

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Reactions for 🔥" })).toBeNull()
    })
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
