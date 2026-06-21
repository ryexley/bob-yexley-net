import { fireEvent, render } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BlipMediaGallery, type BlipMediaGalleryLabels } from "./blip-media-gallery"
import type { BlipMediaRow } from "./data/queries"

const labels: BlipMediaGalleryLabels = {
  close: "Close",
  previous: "Previous",
  next: "Next",
  region: "Media viewer",
  counter: (current, total) => `${current} / ${total}`,
  openItem: (index, total) => `View media ${index} of ${total}`,
}

const media = (over: Partial<BlipMediaRow> = {}): BlipMediaRow =>
  ({
    id: "row",
    blip_id: "blip-1",
    user_id: "user-1",
    media_type: "image",
    mime_type: "image/jpeg",
    storage_key: "media/u/b/photo",
    processing_status: "complete",
    file_size: 1000,
    width: 1600,
    height: 1200,
    duration_s: null,
    display_order: 0,
    created_at: "2026-06-20T00:00:00.000Z",
    ...over,
  }) as BlipMediaRow

beforeEach(() => {
  vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("BlipMediaGallery", () => {
  it("renders nothing when there is no media", () => {
    render(() => <BlipMediaGallery media={[]} labels={labels} />)
    expect(document.querySelector(".blip-media-gallery")).toBeNull()
  })

  it("renders a tappable thumbnail per item using the micro variant", () => {
    const set = [
      media({ id: "a", storage_key: "media/u/b/a", display_order: 0 }),
      media({ id: "b", storage_key: "media/u/b/b", display_order: 1 }),
    ]
    render(() => <BlipMediaGallery media={set} labels={labels} />)

    const items = document.querySelectorAll(".blip-media-gallery-item")
    expect(items).toHaveLength(2)
    const firstImg = items[0].querySelector("img.personal-cloud-image-img")
    expect(firstImg?.getAttribute("src")).toBe("https://cdn.test/media/u/b/a-micro.webp")
    // Lightbox is closed until a thumbnail is tapped.
    expect(document.querySelector(".lightbox")).toBeNull()
  })

  it("uses the same compact teaser tile for a single item", () => {
    render(() => (
      <BlipMediaGallery media={[media({ storage_key: "media/u/b/solo" })]} labels={labels} />
    ))

    const img = document.querySelector(
      ".blip-media-gallery-item img.personal-cloud-image-img",
    )
    expect(img?.getAttribute("src")).toBe("https://cdn.test/media/u/b/solo-micro.webp")
    expect(document.querySelector(".blip-media-gallery.is-single")).toBeNull()
    const item = document.querySelector(".blip-media-gallery-item")
    expect(item?.classList.contains("blip-media-gallery-item")).toBe(true)
  })

  it("opens the lightbox at the tapped index", () => {
    const set = [
      media({ id: "a", storage_key: "media/u/b/a", display_order: 0 }),
      media({ id: "b", storage_key: "media/u/b/b", display_order: 1 }),
      media({ id: "c", storage_key: "media/u/b/c", display_order: 2 }),
    ]
    render(() => <BlipMediaGallery media={set} labels={labels} />)

    const items = document.querySelectorAll(".blip-media-gallery-item")
    fireEvent.click(items[2])

    expect(document.querySelector(".lightbox")).toBeTruthy()
    expect(document.querySelector(".lightbox-counter")?.textContent).toBe("3 / 3")
    const lightboxImg = document.querySelector(
      '.lightbox-slide:not([aria-hidden="true"]) img.personal-cloud-image-img',
    )
    expect(lightboxImg?.getAttribute("src")).toBe("https://cdn.test/media/u/b/c-large.webp")
  })

  it("delegates opens to the parent when onOpenItem is set", () => {
    const set = [
      media({ id: "a", storage_key: "media/u/b/a", display_order: 0 }),
      media({ id: "b", storage_key: "media/u/b/b", display_order: 1 }),
    ]
    const onOpenItem = vi.fn()
    render(() => (
      <BlipMediaGallery
        media={set}
        labels={labels}
        onOpenItem={onOpenItem}
        getOpenItemLabel={record => `Page item ${record.id}`}
      />
    ))

    const items = document.querySelectorAll(".blip-media-gallery-item")
    expect(items[1].getAttribute("aria-label")).toBe("Page item b")
    fireEvent.click(items[1])

    expect(onOpenItem).toHaveBeenCalledWith(set[1])
    expect(document.querySelector(".lightbox")).toBeNull()
  })

  it("renders a static thumb poster for video items", () => {
    render(() => (
      <BlipMediaGallery
        media={[
          media({
            media_type: "video",
            mime_type: "video/mp4",
            storage_key: "media/u/b/clip",
          }),
        ]}
        labels={labels}
      />
    ))

    expect(document.querySelector(".blip-media-gallery-video .play")).toBeTruthy()
    expect(document.querySelector("video.blip-media-gallery-video-el")).toBeNull()
    const poster = document.querySelector(".blip-media-gallery-video-poster")
    expect(poster?.getAttribute("src")).toBe("https://cdn.test/media/u/b/clip-thumb.webp")
  })

  it("falls back to video metadata when the thumb poster is missing", () => {
    render(() => (
      <BlipMediaGallery
        media={[
          media({
            media_type: "video",
            mime_type: "video/mp4",
            storage_key: "media/u/b/legacy",
          }),
        ]}
        labels={labels}
      />
    ))

    const poster = document.querySelector(
      ".blip-media-gallery-video-poster",
    ) as HTMLImageElement
    fireEvent.error(poster)

    const video = document.querySelector("video.blip-media-gallery-video-el")
    expect(video?.getAttribute("src")).toBe(
      "https://cdn.test/media/u/b/legacy-original.mp4",
    )
    expect(document.querySelector(".blip-media-gallery-video .play")).toBeTruthy()
  })
})
