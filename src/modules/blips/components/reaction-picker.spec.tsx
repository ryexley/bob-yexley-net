import { fireEvent, render, screen } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { REACTION_EMOJI_SET } from "@/lib/data/reactions-emoji-set"
import { ReactionPicker } from "@/modules/blips/components/reaction-picker"

const outsideDismissMocks = vi.hoisted(() => ({
  originalPreventDefault: vi.fn(),
  originalStopPropagation: vi.fn(),
}))

vi.mock("@/components/icon", () => ({
  Icon: (props: { name: string }) => <span>{props.name}</span>,
}))

vi.mock("@/components/popover", () => ({
  Popover: (props: { children: unknown }) => <div data-testid="popover">{props.children}</div>,
  PopoverTrigger: (props: any) => <button {...props}>{props.children}</button>,
  PopoverContent: (props: any) => (
    <div
      {...props}
      data-disable-outside-pointer-events={
        props.disableOutsidePointerEvents ? "true" : "false"
      }>
      <button
        type="button"
        data-testid="outside-dismiss"
        onClick={() =>
          props.onPointerDownOutside?.({
            detail: {
              originalEvent: {
                preventDefault: outsideDismissMocks.originalPreventDefault,
                stopPropagation: outsideDismissMocks.originalStopPropagation,
              },
            },
            preventDefault: vi.fn(),
          })
        }>
        outside-dismiss
      </button>
      {props.children}
    </div>
  ),
}))

describe("ReactionPicker", () => {
  it("renders the flattened emoji set and a limit note", () => {
    render(() => (
      <ReactionPicker
        open={false}
        onOpenChange={() => {}}
        onTriggerClick={() => {}}
        onToggleReaction={() => {}}
        activeEmojis={[]}
        triggerAriaLabel="Add reaction"
        limitReached={false}
        busy={false}
      />
    ))

    expect(screen.getByLabelText("Reaction limit").textContent).toBe("Limit 3")
    const content = screen
      .getByLabelText("Reaction limit")
      .closest("[data-disable-outside-pointer-events]")
    expect(content?.getAttribute("data-disable-outside-pointer-events")).toBe("true")
    expect(screen.getAllByRole("button").length).toBe(REACTION_EMOJI_SET.length + 2)
  })

  it("reactively switches to the limit-reached trigger state", async () => {
    render(() => {
      const [limitReached, setLimitReached] = createSignal(false)

      return (
        <>
          <button type="button" onClick={() => setLimitReached(true)}>
            reach-limit
          </button>
          <ReactionPicker
            open={false}
            onOpenChange={() => {}}
            onTriggerClick={() => {}}
            onToggleReaction={() => {}}
            activeEmojis={[]}
            triggerAriaLabel="Add reaction"
            limitReached={limitReached()}
            busy={false}
          />
        </>
      )
    })

    await fireEvent.click(screen.getByRole("button", { name: "reach-limit" }))

    const trigger = screen.getByRole("button", { name: "Add reaction" })

    expect(trigger.getAttribute("aria-disabled")).toBe("true")
    expect(trigger.className).toContain("limit-reached")
  })

  it("hides picker content when the limit is reached", () => {
    render(() => (
      <ReactionPicker
        open
        onOpenChange={() => {}}
        onTriggerClick={() => {}}
        onToggleReaction={() => {}}
        activeEmojis={[]}
        triggerAriaLabel="Add reaction"
        limitReached
        busy={false}
      />
    ))

    expect(screen.queryByLabelText("Reaction limit")).toBeNull()
  })

  it("closes without click-through when tapped outside", async () => {
    const onOpenChange = vi.fn()
    outsideDismissMocks.originalPreventDefault.mockClear()
    outsideDismissMocks.originalStopPropagation.mockClear()

    render(() => (
      <ReactionPicker
        open
        onOpenChange={onOpenChange}
        onTriggerClick={() => {}}
        onToggleReaction={() => {}}
        activeEmojis={[]}
        triggerAriaLabel="Add reaction"
        limitReached={false}
        busy={false}
      />
    ))

    await fireEvent.click(screen.getByTestId("outside-dismiss"))
    await Promise.resolve()

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(outsideDismissMocks.originalPreventDefault).toHaveBeenCalledTimes(1)
    expect(outsideDismissMocks.originalStopPropagation).toHaveBeenCalledTimes(1)
  })
})
