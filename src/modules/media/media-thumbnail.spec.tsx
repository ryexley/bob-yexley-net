import { fireEvent, render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import type { Attachment } from "./media-store"
import { MediaThumbnail } from "./media-thumbnail"

const baseAttachment = (over: Partial<Attachment> = {}): Attachment => ({
  key: "media/u/b/photo",
  previewUrl: "blob:preview",
  status: "saved",
  mediaType: "image",
  ...over,
})

const renderThumbnail = (
  attachment: Attachment,
  handlers: Partial<{
    onRemove: (key: string) => void
    onRetry: (key: string) => void
    onPreview: (attachment: Attachment) => void
  }> = {},
) => {
  const onRemove = handlers.onRemove ?? vi.fn()
  const onRetry = handlers.onRetry ?? vi.fn()
  const onPreview = handlers.onPreview ?? vi.fn()

  const result = render(() => (
    <MediaThumbnail
      attachment={attachment}
      onRemove={onRemove}
      onRetry={onRetry}
      onPreview={onPreview}
      removeLabel="Remove"
      retryLabel="Retry"
      previewLabel="Preview"
    />
  ))

  return { ...result, onRemove, onRetry, onPreview }
}

describe("MediaThumbnail", () => {
  it("renders an <img> preview for an image attachment", () => {
    const { container } = renderThumbnail(baseAttachment())
    const img = container.querySelector("img.media-thumbnail-image")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("src")).toBe("blob:preview")
  })

  it("renders a static poster <img> for a video attachment", () => {
    const { container } = renderThumbnail(
      baseAttachment({
        mediaType: "video",
        posterUrl: "blob:thumb-webp",
        mediaSrc: "blob:video",
      }),
    )
    const img = container.querySelector("img.media-thumbnail-image")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("src")).toBe("blob:thumb-webp")
    expect(container.querySelector("video.media-thumbnail-image")).toBeNull()
    expect(container.querySelector(".media-thumbnail-type-badge")).toBeTruthy()
  })

  it("falls back to <video> when the poster image fails to load", () => {
    const { container } = renderThumbnail(
      baseAttachment({
        mediaType: "video",
        posterUrl: "blob:bad-thumb",
        mediaSrc: "blob:video",
      }),
    )
    const poster = container.querySelector(
      "img.media-thumbnail-image",
    ) as HTMLImageElement
    fireEvent.error(poster)
    expect(container.querySelector("video.media-thumbnail-image")).toBeTruthy()
  })

  it("shows a placeholder when there is no preview url", () => {
    const { container } = renderThumbnail(
      baseAttachment({ previewUrl: undefined, status: "pending" }),
    )
    expect(container.querySelector(".media-thumbnail-placeholder")).toBeTruthy()
  })

  it("shows the circular progress overlay while uploading", () => {
    const { container } = renderThumbnail(
      baseAttachment({ status: "uploading", progress: 40 }),
    )
    expect(container.querySelector(".media-thumbnail-progress")).toBeTruthy()
  })

  it("renders the retry overlay on error and calls onRetry without opening preview", () => {
    const { container, onRetry, onPreview } = renderThumbnail(
      baseAttachment({ status: "error" }),
    )
    const retry = container.querySelector(
      ".media-thumbnail-overlay--error",
    ) as HTMLElement
    expect(retry).toBeTruthy()

    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledWith("media/u/b/photo")
    expect(onPreview).not.toHaveBeenCalled()
  })

  it("removes without opening the preview (stops propagation)", () => {
    const { container, onRemove, onPreview } = renderThumbnail(baseAttachment())
    const remove = container.querySelector(
      ".media-thumbnail-remove",
    ) as HTMLButtonElement

    fireEvent.click(remove)
    expect(onRemove).toHaveBeenCalledWith("media/u/b/photo")
    expect(onPreview).not.toHaveBeenCalled()
  })

  it("opens the preview when the body is clicked", () => {
    const attachment = baseAttachment()
    const { container, onPreview } = renderThumbnail(attachment)
    const body = container.querySelector(
      ".media-thumbnail-body",
    ) as HTMLButtonElement

    fireEvent.click(body)
    expect(onPreview).toHaveBeenCalledWith(attachment)
  })
})
