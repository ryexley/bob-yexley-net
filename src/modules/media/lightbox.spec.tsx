import { fireEvent, render, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  Lightbox,
  LIGHTBOX_DOT_PAGER_MAX,
  isClickInsideObjectFitContain,
  isVideoControlChromeHit,
  type LightboxLabels,
} from "./lightbox"
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
    // Poster backdrop stays up until the first frame is ready.
    const poster = () =>
      document.querySelector(".lightbox-slide[aria-hidden='false'] img.lightbox-video-poster")
    expect(poster()?.getAttribute("src")).toBe("https://cdn.test/media/u/b/clip-thumb.webp")
    fireEvent(video!, new Event("playing"))
    expect(poster()).toBeNull()

    await vi.waitFor(() => expect(play).toHaveBeenCalled())

    fireEvent.click(video!)
    expect(video?.hasAttribute("controls")).toBe(true)
    play.mockRestore()
  })

  it("only loads the visible video and releases it after navigating away", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
    const clips = ["one", "two", "three"].map((name, i) =>
      media({
        id: name,
        storage_key: `media/u/b/${name}`,
        media_type: "video",
        mime_type: "video/quicktime",
        display_order: i,
      }),
    )

    render(() => (
      <Lightbox media={clips} index={0} onClose={vi.fn()} labels={labels} />
    ))

    const withSrc = () =>
      Array.from(document.querySelectorAll("video.lightbox-video")).filter(el =>
        el.hasAttribute("src"),
      ) as HTMLVideoElement[]

    expect(document.querySelectorAll("video.lightbox-video").length).toBe(5)
    expect(withSrc().map(el => el.getAttribute("src"))).toEqual([
      "https://cdn.test/media/u/b/one-original.mov",
    ])
    const first = visibleVideo()!
    expect(first.getAttribute("poster")).toBe("https://cdn.test/media/u/b/one-thumb.webp")
    for (const el of document.querySelectorAll("video.lightbox-video:not([src])")) {
      expect(el.getAttribute("preload")).toBe("none")
    }

    load.mockClear()
    fireEvent.click(document.querySelector(".lightbox-nav-next") as Element)

    expect(withSrc().map(el => el.getAttribute("src"))).toEqual([
      "https://cdn.test/media/u/b/two-original.mov",
    ])
    expect(first.hasAttribute("src")).toBe(false)
    expect(load).toHaveBeenCalled()
    await vi.waitFor(() => expect(play).toHaveBeenCalled())

    play.mockRestore()
    pause.mockRestore()
    load.mockRestore()
  })

  describe("loading states", () => {
    const clip = (name: string, i = 0) =>
      media({
        id: name,
        storage_key: `media/u/b/${name}`,
        media_type: "video",
        mime_type: "video/quicktime",
        display_order: i,
      })
    const visibleSlide = () =>
      document.querySelector('.lightbox-slide[aria-hidden="false"]') as HTMLElement
    const spinner = () =>
      visibleSlide()?.querySelector('.lightbox-loading[role="status"]') as HTMLElement | null
    const allSpinners = () => document.querySelectorAll(".lightbox-loading")
    let play: ReturnType<typeof vi.spyOn>
    let pause: ReturnType<typeof vi.spyOn>
    let load: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
      pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
      load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
    })

    afterEach(() => {
      play.mockRestore()
      pause.mockRestore()
      load.mockRestore()
    })

    it("shows the poster and a labelled spinner until the video can play", () => {
      render(() => (
        <Lightbox media={[clip("solo")]} index={0} onClose={vi.fn()} labels={labels} />
      ))

      const wrap = visibleSlide().querySelector(".lightbox-video-wrap") as HTMLElement
      expect(spinner()?.textContent).toBe("Loading video")
      expect(wrap.getAttribute("aria-busy")).toBe("true")
      expect(wrap.querySelector("img.lightbox-video-poster")?.getAttribute("src")).toBe(
        "https://cdn.test/media/u/b/solo-thumb.webp",
      )

      fireEvent(visibleVideo()!, new Event("canplay"))

      expect(spinner()).toBeNull()
      expect(wrap.getAttribute("aria-busy")).toBe("false")
      expect(wrap.querySelector("img.lightbox-video-poster")).toBeNull()
    })

    it("shows the spinner again while buffering mid-play", () => {
      render(() => (
        <Lightbox media={[clip("solo")]} index={0} onClose={vi.fn()} labels={labels} />
      ))
      const video = visibleVideo()!
      fireEvent(video, new Event("playing"))
      expect(spinner()).toBeNull()

      fireEvent(video, new Event("waiting"))
      expect(spinner()?.textContent).toBe("Loading video")
      // Keep the paused frame visible rather than flashing the poster back.
      expect(visibleSlide().querySelector("img.lightbox-video-poster")).toBeNull()

      fireEvent(video, new Event("playing"))
      expect(spinner()).toBeNull()
    })

    it("ignores a stalled event when enough data is buffered", () => {
      render(() => (
        <Lightbox media={[clip("solo")]} index={0} onClose={vi.fn()} labels={labels} />
      ))
      const video = visibleVideo()!
      fireEvent(video, new Event("playing"))
      Object.defineProperty(video, "readyState", { configurable: true, value: 4 })
      fireEvent(video, new Event("stalled"))
      expect(spinner()).toBeNull()
    })

    it("shows an error with a retry that reloads the video", () => {
      render(() => (
        <Lightbox media={[clip("solo")]} index={0} onClose={vi.fn()} labels={labels} />
      ))
      const video = visibleVideo()!
      fireEvent(video, new Event("error"))

      const alert = visibleSlide().querySelector('[role="alert"]')
      expect(alert?.textContent).toContain("This video couldn't be loaded.")
      expect(spinner()).toBeNull()

      play.mockClear()
      fireEvent.click(alert!.querySelector("button.lightbox-video-retry")!)

      expect(visibleSlide().querySelector('[role="alert"]')).toBeNull()
      expect(spinner()?.textContent).toBe("Loading video")
      expect(video.getAttribute("src")).toBe("https://cdn.test/media/u/b/solo-original.mov")
      expect(load).toHaveBeenCalled()
      expect(play).toHaveBeenCalled()
    })

    it("only spins for the visible video and resets the one left behind", () => {
      render(() => (
        <Lightbox
          media={[clip("one", 0), clip("two", 1), clip("three", 2)]}
          index={0}
          onClose={vi.fn()}
          labels={labels}
        />
      ))
      expect(allSpinners().length).toBe(1)
      const first = visibleVideo()!
      fireEvent(first, new Event("playing"))
      expect(allSpinners().length).toBe(0)

      fireEvent.click(document.querySelector(".lightbox-nav-next") as Element)

      expect(allSpinners().length).toBe(1)
      expect(first.hasAttribute("src")).toBe(false)
      expect(first.closest(".lightbox-video-wrap")?.getAttribute("data-video-state")).toBe("idle")
      // Releasing the old video must not surface an error for it.
      fireEvent(first, new Event("error"))
      expect(document.querySelector('[role="alert"]')).toBeNull()
      expect(
        Array.from(document.querySelectorAll("video.lightbox-video")).filter(el =>
          el.hasAttribute("src"),
        ).length,
      ).toBe(1)
    })

    it("shows a blurred micro backdrop and spinner until the full image loads", () => {
      render(() => (
        <Lightbox media={set} index={0} onClose={vi.fn()} labels={labels} />
      ))
      const frame = visibleSlide().querySelector(".lightbox-image-frame") as HTMLElement
      expect(frame.classList.contains("is-loading")).toBe(true)
      expect(frame.getAttribute("aria-busy")).toBe("true")
      expect(spinner()?.textContent).toBe("Loading image")
      expect(frame.querySelector("img.lightbox-image-backdrop")?.getAttribute("src")).toBe(
        "https://cdn.test/media/u/b/a-micro.webp",
      )

      fireEvent.load(image()!)

      expect(frame.classList.contains("is-loading")).toBe(false)
      expect(frame.getAttribute("aria-busy")).toBe("false")
      expect(spinner()).toBeNull()
      expect(frame.querySelector("img.lightbox-image-backdrop")).toBeNull()
    })

    it("does not spin for gifs", () => {
      render(() => (
        <Lightbox media={set} index={2} onClose={vi.fn()} labels={labels} />
      ))
      expect(document.querySelector("img.lightbox-gif")).toBeTruthy()
      expect(spinner()).toBeNull()
    })
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

  it("keeps the dot pager at or below the compact threshold", () => {
    render(() => (
      <Lightbox media={set} index={0} onClose={vi.fn()} labels={labels} />
    ))

    expect(document.querySelector(".lightbox-dots")).toBeTruthy()
    expect(document.querySelector(".lightbox-indicator")?.classList.contains("is-compact")).toBe(
      false,
    )
    expect(document.querySelector(".lightbox-pager-next")).toBeNull()
  })

  it("switches to a compact chevron pager above the dot threshold", () => {
    const many = Array.from({ length: LIGHTBOX_DOT_PAGER_MAX + 1 }, (_, index) =>
      media({
        id: `row-${index}`,
        storage_key: `media/u/b/${index}`,
        display_order: index,
      }),
    )

    render(() => (
      <Lightbox media={many} index={1} onClose={vi.fn()} labels={labels} />
    ))

    expect(document.querySelector(".lightbox-dots")).toBeNull()
    expect(document.querySelector(".lightbox-indicator")?.classList.contains("is-compact")).toBe(
      true,
    )
    expect(counter()).toBe(`2 / ${many.length}`)

    fireEvent.click(document.querySelector(".lightbox-pager-next") as Element)
    expect(counter()).toBe(`3 / ${many.length}`)

    fireEvent.click(document.querySelector(".lightbox-pager-previous") as Element)
    expect(counter()).toBe(`2 / ${many.length}`)
  })

  it("calls onClose when the close button is activated", () => {
    const onClose = vi.fn()
    render(() => (
      <Lightbox media={set} index={0} onClose={onClose} labels={labels} />
    ))

    fireEvent.click(document.querySelector(".lightbox-close") as Element)
    expect(onClose).toHaveBeenCalled()
  })

  it("releases document scroll after the lightbox unmounts", async () => {
    const Harness = () => {
      const [index, setIndex] = createSignal<number | null>(0)
      return (
        <Lightbox
          media={set}
          index={index()}
          onClose={() => setIndex(null)}
          labels={labels}
        />
      )
    }

    render(() => <Harness />)

    fireEvent.click(document.querySelector(".lightbox-close") as Element)

    await waitFor(() => {
      expect(document.querySelector(".lightbox")).toBeNull()
      expect(document.querySelector(".lightbox-dialog")).toBeNull()
      expect(document.documentElement.style.overflow).not.toBe("hidden")
      expect(document.body.style.overflow).not.toBe("hidden")
    })
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

  it("does not replay a video when native controls are already showing", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined)
    mockMobileViewport()
    render(() => (
      <Lightbox
        media={set}
        index={1}
        onClose={vi.fn()}
        labels={labels}
      />
    ))

    await vi.waitFor(() => expect(play).toHaveBeenCalled())
    const video = visibleVideo()
    expect(video).toBeTruthy()
    fireEvent.click(video!)
    expect(video?.hasAttribute("controls")).toBe(true)

    play.mockClear()
    Object.defineProperty(video!, "paused", {
      configurable: true,
      get: () => true,
    })
    fireEvent.click(video!)
    expect(play).not.toHaveBeenCalled()
    play.mockRestore()
  })

  it("does not treat a scrub/pause gesture on video chrome as a carousel swipe", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined)
    mockMobileViewport()
    render(() => (
      <Lightbox
        media={set}
        index={1}
        onClose={vi.fn()}
        labels={labels}
      />
    ))

    await vi.waitFor(() => expect(visibleVideo()).toBeTruthy())
    const video = visibleVideo()!
    fireEvent.click(video)
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(video, { clientX: 200, clientY: 280, pointerId: 1 })
    fireEvent.pointerMove(stage(), { clientX: 80, clientY: 280, pointerId: 1 })
    fireEvent.pointerUp(stage(), { clientX: 40, clientY: 280, pointerId: 1 })

    expect(counter()).toBe("2 / 3")
    play.mockRestore()
  })

  it("still swipes between slides from the video body", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined)
    mockMobileViewport()
    render(() => (
      <Lightbox
        media={set}
        index={1}
        onClose={vi.fn()}
        labels={labels}
      />
    ))

    await vi.waitFor(() => expect(visibleVideo()).toBeTruthy())
    const video = visibleVideo()!
    fireEvent.click(video)
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(video, { clientX: 200, clientY: 80, pointerId: 1 })
    fireEvent.pointerMove(stage(), { clientX: 80, clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(stage(), { clientX: 40, clientY: 80, pointerId: 1 })

    expect(counter()).toBe("3 / 3")
    play.mockRestore()
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

describe("isVideoControlChromeHit", () => {
  const videoBox = () => {
    const video = document.createElement("video")
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    })
    return video
  }

  it("treats the bottom control strip as chrome and the picture as swipeable", () => {
    const video = videoBox()
    expect(isVideoControlChromeHit(200, 280, video)).toBe(true)
    expect(isVideoControlChromeHit(200, 80, video)).toBe(false)
    expect(isVideoControlChromeHit(-10, 280, video)).toBe(false)
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
