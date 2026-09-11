import { fireEvent, render, screen } from "@solidjs/testing-library"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { PasteMediaPlacementPrompt } from "./paste-media-placement-prompt"

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
})

const labels = {
  title: "Place pasted media",
  description: "Choose a destination.",
  inlineLabel: "Inline in post",
  galleryLabel: "Gallery strip",
  cancelLabel: "Cancel",
}

describe("PasteMediaPlacementPrompt", () => {
  it("does not render when closed", () => {
    render(() => (
      <PasteMediaPlacementPrompt
        open={false}
        isMobile={false}
        {...labels}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />
    ))
    expect(screen.queryByText(labels.title)).toBeNull()
  })

  it("chooses inline or gallery and can cancel", async () => {
    const onChoose = vi.fn()
    const onCancel = vi.fn()
    render(() => (
      <PasteMediaPlacementPrompt
        open
        isMobile={false}
        {...labels}
        onChoose={onChoose}
        onCancel={onCancel}
      />
    ))

    expect(await screen.findByText(labels.title)).toBeTruthy()

    fireEvent.click(screen.getByText(labels.inlineLabel))
    expect(onChoose).toHaveBeenCalledWith("inline")

    fireEvent.click(screen.getByText(labels.galleryLabel))
    expect(onChoose).toHaveBeenCalledWith("gallery")

    fireEvent.click(screen.getByText(labels.cancelLabel))
    expect(onCancel).toHaveBeenCalled()
  })

  it("opens a nested top drawer on phone-sized viewports", async () => {
    render(() => (
      <PasteMediaPlacementPrompt
        open
        isMobile
        {...labels}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />
    ))

    expect(await screen.findByText(labels.title)).toBeTruthy()
    const host = document.querySelector(".paste-media-placement")
    const drawer = host?.querySelector(
      "[data-corvu-drawer-content].paste-media-placement-drawer",
    )
    expect(host).toBeTruthy()
    expect(drawer).toBeTruthy()
    expect(drawer?.getAttribute("data-side")).toBe("top")
    expect(
      document.body.querySelector(
        ":scope > [data-corvu-drawer-content].paste-media-placement-drawer",
      ),
    ).toBeNull()
  })
})
