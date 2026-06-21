import { fireEvent, render } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { BlipMedia } from "./media-store"
import type { Attachment } from "./media-store"
import { ComposerPreviewModal } from "./composer-preview-modal"

const committedImage = (
  over: Partial<BlipMedia> = {},
): Attachment => ({
  key: "media/u/b/photo",
  status: "saved",
  mediaType: "image",
  previewUrl: "blob:preview",
  record: {
    id: "row-1",
    blip_id: "b",
    user_id: "u",
    media_type: "image",
    mime_type: "image/jpeg",
    storage_key: "media/u/b/photo",
    processing_status: "complete",
    file_size: 1000,
    width: 100,
    height: 100,
    duration_s: null,
    display_order: 0,
    created_at: "2026-06-20T00:00:00.000Z",
    ...over,
  } as BlipMedia,
})

beforeEach(() => {
  vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("ComposerPreviewModal", () => {
  it("renders nothing when there is no attachment", () => {
    render(() => (
      <ComposerPreviewModal
        attachment={null}
        onClose={vi.fn()}
        closeLabel="Close"
      />
    ))
    expect(document.querySelector(".composer-preview-media")).toBeNull()
  })

  it("renders the large variant for a committed image, falling back on error", () => {
    render(() => (
      <ComposerPreviewModal
        attachment={committedImage()}
        onClose={vi.fn()}
        closeLabel="Close"
      />
    ))

    const img = document.querySelector(
      "img.composer-preview-media",
    ) as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute("src")).toBe(
      "https://cdn.test/media/u/b/photo-large.webp",
    )

    fireEvent.error(img)
    expect(img.getAttribute("src")).toBe(
      "https://cdn.test/media/u/b/photo-medium.webp",
    )

    fireEvent.error(img)
    expect(img.getAttribute("src")).toBe(
      "https://cdn.test/media/u/b/photo-original.jpg",
    )
  })

  it("renders a video element for a video attachment", () => {
    const attachment: Attachment = {
      key: "media/u/b/clip",
      status: "saved",
      mediaType: "video",
      previewUrl: "blob:clip",
      record: {
        id: "row-2",
        blip_id: "b",
        user_id: "u",
        media_type: "video",
        mime_type: "video/mp4",
        storage_key: "media/u/b/clip",
        processing_status: "complete",
        file_size: 1000,
        width: null,
        height: null,
        duration_s: 10,
        display_order: 0,
        created_at: "2026-06-20T00:00:00.000Z",
      } as BlipMedia,
    }

    render(() => (
      <ComposerPreviewModal
        attachment={attachment}
        onClose={vi.fn()}
        closeLabel="Close"
      />
    ))

    const video = document.querySelector(
      "video.composer-preview-media",
    ) as HTMLVideoElement
    expect(video).toBeTruthy()
    expect(video.getAttribute("src")).toBe(
      "https://cdn.test/media/u/b/clip-original.mp4",
    )
  })
})
