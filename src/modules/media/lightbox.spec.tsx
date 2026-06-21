import { fireEvent, render } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Lightbox, isClickInsideObjectFitContain, type LightboxLabels } from "./lightbox"
import type { BlipMediaRow } from "./data/queries"

const labels: LightboxLabels = {
  close: "Close",
  previous: "Previous",
  next: "Next",
  region: "Media viewer",
  counter: (current, total) => `${current} / ${total}`,
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

const set = [
  media({ id: "a", storage_key: "media/u/b/a", display_order: 0 }),
  media({
    id: "b",
    storage_key: "media/u/b/clip",
    media_type: "video",
    mime_type: "video/mp4",
    display_order: 1,
  }),
  media({
    id: "c",
    storage_key: "media/u/b/anim",
    media_type: "gif",
    mime_type: "image/gif",
    display_order: 2,
  }),
]

const image = () =>
  document.querySelector("img.personal-cloud-image-img") as HTMLImageElement | null
const visibleVideo = () =>
  document.querySelector(
    '.lightbox-slide[aria-hidden="false"] video.lightbox-video',
  ) as HTMLVideoElement | null
const counter = () => document.querySelector(".lightbox-counter")?.textContent
const stage = () => document.querySelector(".lightbox-stage") as Element

const mockMobileViewport = () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const track = () => document.querySelector(".lightbox-track") as HTMLElement | null

const swipeStage = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  fireEvent.pointerDown(stage(), { clientX: from.x, clientY: from.y, pointerId: 1 })
  fireEvent.pointerMove(stage(), {
    clientX: from.x + (to.x - from.x) * 0.5,
    clientY: from.y + (to.y - from.y) * 0.5,
    pointerId: 1,
  })
  fireEvent.pointerUp(stage(), { clientX: to.x, clientY: to.y, pointerId: 1 })
}

beforeEach(() => {
  vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("Lightbox", () => {
  it("stays closed when index is null", () => {
    render(() => (
      <Lightbox media={set} index={null} onClose={vi.fn()} labels={labels} />
    ))
    expect(document.querySelector(".lightbox")).toBeNull()
  })

  it("opens at the given index with the desktop large variant + counter", () => {
    render(() => (
      <Lightbox media={set} index={0} onClose={vi.fn()} labels={labels} />
    ))

    expect(image()?.getAttribute("src")).toBe("https://cdn.test/media/u/b/a-large.webp")
    expect(counter()).toBe("1 / 3")
  })

  it("navigates with the next arrow and autoplays a video slide with a poster", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)

    render(() => (
      <Lightbox media={set} index={0} onClose={vi.fn()} labels={labels} />
    ))

    fireEvent.click(document.querySelector(".lightbox-nav-next") as Element)

    expect(counter()).toBe("2 / 3")
    const video = visibleVideo()
    expect(video?.getAttribute("src")).toBe("https://cdn.test/media/u/b/clip-original.mp4")
    expect(video?.hasAttribute("autoplay")).toBe(false)
    expect(video?.hasAttribute("muted")).toBe(false)
    expect(video?.hasAttribute("controls")).toBe(false)
    expect(
      document.querySelector(".lightbox-slide[aria-hidden='false'] img.lightbox-video-poster"),
    ).toBeNull()

    await vi.waitFor(() => expect(play).toHaveBeenCalled())

    fireEvent.click(video!)
    expect(video?.hasAttribute("controls")).toBe(true)
    play.mockRestore()
  })

  it("navigates with the arrow keys and renders an animated gif on the last slide", () => {
    render(() => (
      <Lightbox media={set} index={1} onClose={vi.fn()} labels={labels} />
    ))

    fireEvent.keyDown(document, { key: "ArrowRight" })

    expect(counter()).toBe("3 / 3")
    const gif = document.querySelector("img.lightbox-gif") as HTMLImageElement
    expect(gif?.getAttribute("src")).toBe("https://cdn.test/media/u/b/anim-original.gif")
  })

  it("wraps from the last slide to the first when navigating forward", () => {
    render(() => (
      <Lightbox media={set} index={2} onClose={vi.fn()} labels={labels} />
    ))

    expect(counter()).toBe("3 / 3")
    expect(document.querySelector(".lightbox-nav-next")).toBeTruthy()

    fireEvent.keyDown(document, { key: "ArrowRight" })
    expect(counter()).toBe("1 / 3")
    expect(image()?.getAttribute("src")).toBe("https://cdn.test/media/u/b/a-large.webp")
  })

  it("wraps from the first slide to the last when navigating backward", () => {
    render(() => (
      <Lightbox media={set} index={0} onClose={vi.fn()} labels={labels} />
    ))

    expect(counter()).toBe("1 / 3")
    expect(document.querySelector(".lightbox-nav-previous")).toBeTruthy()

    fireEvent.keyDown(document, { key: "ArrowLeft" })
    expect(counter()).toBe("3 / 3")
    const gif = document.querySelector("img.lightbox-gif") as HTMLImageElement
    expect(gif?.getAttribute("src")).toBe("https://cdn.test/media/u/b/anim-original.gif")
  })

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    fireEvent.click(document.querySelector(".lightbox") as Element)
    expect(onClose).toHaveBeenCalled()
  })

  it("does not close when the media is clicked", () => {
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    const img = document.querySelector("img.personal-cloud-image-img") as HTMLImageElement
    vi.spyOn(img, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 100,
      width: 400,
      height: 400,
      top: 100,
      left: 100,
      right: 500,
      bottom: 500,
      toJSON: () => ({}),
    })
    Object.defineProperty(img, "naturalWidth", { value: 400, configurable: true })
    Object.defineProperty(img, "naturalHeight", { value: 200, configurable: true })

    fireEvent(
      img,
      new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }),
    )

    expect(onClose).not.toHaveBeenCalled()
  })

  it("closes when the letterbox area beside the image is clicked", () => {
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    const img = document.querySelector("img.personal-cloud-image-img") as HTMLImageElement
    vi.spyOn(img, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 100,
      width: 400,
      height: 400,
      top: 100,
      left: 100,
      right: 500,
      bottom: 500,
      toJSON: () => ({}),
    })
    Object.defineProperty(img, "naturalWidth", { value: 400, configurable: true })
    Object.defineProperty(img, "naturalHeight", { value: 200, configurable: true })

    fireEvent(
      img,
      new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 210, clientY: 450 }),
    )

    expect(onClose).toHaveBeenCalled()
  })

  it("calls onClose when the close button is activated", () => {
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    fireEvent.click(document.querySelector(".lightbox-close") as Element)
    expect(onClose).toHaveBeenCalled()
  })

  it("closes on a dominant vertical swipe on mobile", () => {
    mockMobileViewport()
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    swipeStage({ x: 100, y: 200 }, { x: 100, y: 120 })
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    swipeStage({ x: 100, y: 120 }, { x: 100, y: 200 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("navigates horizontally on mobile when the swipe is mostly horizontal", () => {
    mockMobileViewport()
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    swipeStage({ x: 200, y: 300 }, { x: 100, y: 310 })

    expect(onClose).not.toHaveBeenCalled()
    expect(counter()).toBe("2 / 3")
  })

  it("moves the carousel track with a horizontal drag on mobile", () => {
    mockMobileViewport()
    render(() => (
      <Lightbox media={set} index={0} onClose={vi.fn()} labels={labels} />
    ))

    fireEvent.pointerDown(stage(), { clientX: 200, clientY: 300, pointerId: 1 })
    fireEvent.pointerMove(stage(), { clientX: 120, clientY: 300, pointerId: 1 })

    expect(track()?.style.transform).toContain("-80px")
    expect(track()?.classList.contains("is-dragging")).toBe(true)
  })

  it("renders a pinch surface for mobile photos", () => {
    mockMobileViewport()
    render(() => (
      <Lightbox media={set} index={0} onClose={vi.fn()} labels={labels} />
    ))

    expect(document.querySelector(".lightbox-pinch-zoom")).toBeTruthy()
    expect(document.querySelector(".lightbox-media.is-zoomable")).toBeTruthy()
  })
})

describe("isClickInsideObjectFitContain", () => {
  it("returns false for letterbox clicks beside a wide image", () => {
    const img = document.createElement("img")
    vi.spyOn(img, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      right: 400,
      bottom: 400,
      toJSON: () => ({}),
    })
    Object.defineProperty(img, "naturalWidth", { value: 400 })
    Object.defineProperty(img, "naturalHeight", { value: 200 })

    expect(isClickInsideObjectFitContain(10, 50, img)).toBe(false)
    expect(isClickInsideObjectFitContain(200, 200, img)).toBe(true)
  })
})
