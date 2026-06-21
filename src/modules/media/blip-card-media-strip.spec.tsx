import { fireEvent, render } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  BlipCardMediaStrip,
  type BlipCardMediaStripLabels,
} from "./blip-card-media-strip"
import type { BlipMediaRow } from "./data/queries"

const labels: BlipCardMediaStripLabels = {
  region: count => `${count} attachments`,
  overflow: count => `+${count}`,
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

describe("BlipCardMediaStrip", () => {
  it("renders nothing when there is no media", () => {
    render(() => <BlipCardMediaStrip media={[]} labels={labels} />)
    expect(document.querySelector(".blip-card-media-strip")).toBeNull()
  })

  it("renders an image thumbnail using the small variant", () => {
    render(() => (
      <BlipCardMediaStrip
        media={[media({ storage_key: "media/u/b/a" })]}
        labels={labels}
      />
    ))

    const img = document.querySelector(
      ".blip-card-media-strip .personal-cloud-image-img",
    )
    expect(img?.getAttribute("src")).toBe("https://cdn.test/media/u/b/a-small.webp")
  })

  it("renders a gif as the static thumbnail frame", () => {
    render(() => (
      <BlipCardMediaStrip
        media={[
          media({
            media_type: "gif",
            mime_type: "image/gif",
            storage_key: "media/u/b/loop",
          }),
        ]}
        labels={labels}
      />
    ))

    const gif = document.querySelector(".blip-card-media-strip .gif")
    expect(gif?.getAttribute("src")).toBe("https://cdn.test/media/u/b/loop-thumb.webp")
  })

  it("falls back to the animated original gif when the static frame is missing", () => {
    render(() => (
      <BlipCardMediaStrip
        media={[
          media({
            media_type: "gif",
            mime_type: "image/gif",
            storage_key: "media/u/b/loop",
          }),
        ]}
        labels={labels}
      />
    ))

    const gif = document.querySelector(".blip-card-media-strip .gif") as HTMLImageElement
    fireEvent.error(gif)
    expect(gif.getAttribute("src")).toBe("https://cdn.test/media/u/b/loop-original.gif")
  })

  it("renders a video as a static poster image with a play overlay", () => {
    render(() => (
      <BlipCardMediaStrip
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

    expect(document.querySelector(".blip-card-media-strip .play")).toBeTruthy()
    // No <video> element on the feed — a lightweight poster <img> instead.
    expect(document.querySelector(".blip-card-media-strip video")).toBeNull()
    const poster = document.querySelector(".blip-card-media-strip .video .poster")
    expect(poster?.getAttribute("src")).toBe("https://cdn.test/media/u/b/clip-thumb.webp")
  })

  it("falls back to a muted video first frame when the poster is missing", () => {
    render(() => (
      <BlipCardMediaStrip
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

    const poster = document.querySelector(
      ".blip-card-media-strip .video .poster",
    ) as HTMLImageElement
    fireEvent.error(poster)

    const video = document.querySelector(".blip-card-media-strip .video video")
    expect(video?.getAttribute("src")).toBe("https://cdn.test/media/u/b/clip-original.mp4")
    expect(document.querySelector(".blip-card-media-strip .play")).toBeTruthy()
  })

  it("caps at three thumbnails and shows a +n overflow tile", () => {
    const set = Array.from({ length: 5 }, (_, index) =>
      media({ id: `m${index}`, storage_key: `media/u/b/m${index}`, display_order: index }),
    )
    render(() => <BlipCardMediaStrip media={set} labels={labels} />)

    expect(document.querySelectorAll(".blip-card-media-strip .item")).toHaveLength(3)
    const overflow = document.querySelector(".blip-card-media-strip .overflow")
    expect(overflow?.textContent).toBe("+2")
  })

  it("shows no overflow tile when there are three or fewer items", () => {
    const set = [
      media({ id: "a", storage_key: "media/u/b/a" }),
      media({ id: "b", storage_key: "media/u/b/b" }),
      media({ id: "c", storage_key: "media/u/b/c" }),
    ]
    render(() => <BlipCardMediaStrip media={set} labels={labels} />)

    expect(document.querySelectorAll(".blip-card-media-strip .item")).toHaveLength(3)
    expect(document.querySelector(".blip-card-media-strip .overflow")).toBeNull()
  })

  it("is non-interactive — no buttons or links in the strip", () => {
    const set = Array.from({ length: 4 }, (_, index) =>
      media({ id: `m${index}`, storage_key: `media/u/b/m${index}` }),
    )
    render(() => <BlipCardMediaStrip media={set} labels={labels} />)

    const strip = document.querySelector(".blip-card-media-strip")
    expect(strip?.querySelectorAll("button, a")).toHaveLength(0)
    expect(strip?.getAttribute("aria-label")).toBe("4 attachments")
  })
})
