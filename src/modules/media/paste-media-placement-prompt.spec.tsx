import { fireEvent, render, screen } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { PasteMediaPlacementPrompt } from "./paste-media-placement-prompt"

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

  it("chooses inline or gallery and can cancel", () => {
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

    fireEvent.click(screen.getByText(labels.inlineLabel))
    expect(onChoose).toHaveBeenCalledWith("inline")

    fireEvent.click(screen.getByText(labels.galleryLabel))
    expect(onChoose).toHaveBeenCalledWith("gallery")

    fireEvent.click(screen.getByText(labels.cancelLabel))
    expect(onCancel).toHaveBeenCalled()
  })
})
