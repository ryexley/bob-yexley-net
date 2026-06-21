import { createSignal } from "solid-js"
import { render } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Attachment } from "./media-store"
import { ThumbnailStrip } from "./thumbnail-strip"

const attachment = (key: string): Attachment => ({
  key,
  previewUrl: `blob:${key}`,
  status: "saved",
  mediaType: "image",
})

const renderStrip = (attachments: Attachment[]) =>
  render(() => (
    <ThumbnailStrip
      attachments={() => attachments}
      onRemove={vi.fn()}
      onRetry={vi.fn()}
      onPreview={vi.fn()}
      removeLabel="Remove"
      retryLabel="Retry"
      previewLabel="Preview"
    />
  ))

describe("ThumbnailStrip", () => {
  it("renders nothing when there are no attachments", () => {
    const { container } = renderStrip([])
    expect(container.querySelector(".media-thumbnail-strip")).toBeNull()
  })

  it("renders one item per attachment", () => {
    const { container } = renderStrip([attachment("a"), attachment("b")])
    expect(container.querySelector(".media-thumbnail-strip")).toBeTruthy()
    expect(
      container.querySelectorAll(".media-thumbnail-strip-item"),
    ).toHaveLength(2)
  })

  describe("append scroll", () => {
    let scrollIntoViewSpy: ReturnType<typeof vi.spyOn>
    let rafCallbacks: FrameRequestCallback[]
    let rafId: number

    beforeEach(() => {
      rafCallbacks = []
      rafId = 0
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
        rafCallbacks.push(callback)
        rafId += 1
        return rafId
      })
      if (typeof HTMLElement.prototype.scrollIntoView !== "function") {
        HTMLElement.prototype.scrollIntoView = () => {}
      }
      scrollIntoViewSpy = vi
        .spyOn(HTMLElement.prototype, "scrollIntoView")
        .mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    const flushScrollAnimationFrame = () => {
      const pending = [...rafCallbacks]
      rafCallbacks = []
      for (const callback of pending) {
        callback(0)
      }
    }

    const flushScrollAnimationFrames = () => {
      flushScrollAnimationFrame()
      flushScrollAnimationFrame()
    }

    it("scrolls to the end when attachments are appended", () => {
      const [attachments, setAttachments] = createSignal<Attachment[]>([
        attachment("a"),
        attachment("b"),
      ])

      render(() => (
        <ThumbnailStrip
          attachments={attachments}
          onRemove={vi.fn()}
          onRetry={vi.fn()}
          onPreview={vi.fn()}
          removeLabel="Remove"
          retryLabel="Retry"
          previewLabel="Preview"
        />
      ))

      setAttachments(current => [...current, attachment("c")])
      flushScrollAnimationFrames()

      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "nearest",
        inline: "end",
      })
    })

    it("does not scroll when attachments are reordered without appending", () => {
      const [attachments, setAttachments] = createSignal<Attachment[]>([
        attachment("a"),
        attachment("b"),
      ])

      render(() => (
        <ThumbnailStrip
          attachments={attachments}
          onRemove={vi.fn()}
          onRetry={vi.fn()}
          onPreview={vi.fn()}
          removeLabel="Remove"
          retryLabel="Retry"
          previewLabel="Preview"
        />
      ))

      scrollIntoViewSpy.mockClear()
      setAttachments([attachment("b"), attachment("a")])
      flushScrollAnimationFrames()

      expect(scrollIntoViewSpy).not.toHaveBeenCalled()
    })
  })
})
