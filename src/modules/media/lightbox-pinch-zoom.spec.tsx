import { fireEvent, render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import {
  clampPinchPan,
  isPinchZoomed,
  LightboxPinchZoom,
  MAX_PINCH_SCALE,
  MIN_PINCH_SCALE,
  pinchCenter,
  pinchDistance,
  snapPinchTransform,
} from "./lightbox-pinch-zoom"

describe("pinchDistance", () => {
  it("returns 0 for fewer than two touches", () => {
    expect(pinchDistance([])).toBe(0)
    expect(pinchDistance([{ clientX: 0, clientY: 0 }])).toBe(0)
  })

  it("returns the distance between two touches", () => {
    expect(
      pinchDistance([
        { clientX: 0, clientY: 0 },
        { clientX: 3, clientY: 4 },
      ]),
    ).toBe(5)
  })
})

describe("pinchCenter", () => {
  it("returns the midpoint between two touches", () => {
    expect(
      pinchCenter([
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 200 },
      ]),
    ).toEqual({ x: 50, y: 100 })
  })
})

describe("clampPinchPan", () => {
  it("clamps pan to the scaled overflow bounds", () => {
    expect(
      clampPinchPan({ scale: 2, x: 999, y: -999 }, 200, 100),
    ).toEqual({ scale: 2, x: 100, y: -50 })
  })
})

describe("snapPinchTransform", () => {
  it("snaps near-1x zoom back to identity", () => {
    expect(snapPinchTransform({ scale: 1.02, x: 4, y: -3 }, 320, 480)).toEqual({
      scale: MIN_PINCH_SCALE,
      x: 0,
      y: 0,
    })
  })

  it("keeps zoomed transforms clamped", () => {
    expect(
      snapPinchTransform({ scale: MAX_PINCH_SCALE, x: 500, y: 500 }, 200, 200),
    ).toEqual({ scale: MAX_PINCH_SCALE, x: 300, y: 300 })
  })
})

describe("isPinchZoomed", () => {
  it("treats identity scale as not zoomed", () => {
    expect(isPinchZoomed(MIN_PINCH_SCALE)).toBe(false)
  })

  it("treats meaningfully scaled transforms as zoomed", () => {
    expect(isPinchZoomed(1.2)).toBe(true)
  })
})

describe("LightboxPinchZoom", () => {
  const mountPinchZoom = (onInteractionLock = vi.fn()) => {
    render(() => (
      <LightboxPinchZoom
        enabled={true}
        onInteractionLock={onInteractionLock}>
        <img
          alt=""
          class="fixture-image"
        />
      </LightboxPinchZoom>
    ))

    const surface = document.querySelector(".lightbox-pinch-zoom") as HTMLElement
    const inner = document.querySelector(".lightbox-pinch-zoom-inner") as HTMLElement
    Object.defineProperty(surface, "clientWidth", { value: 320, configurable: true })
    Object.defineProperty(surface, "clientHeight", { value: 480, configurable: true })
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 320,
      height: 480,
      top: 0,
      left: 0,
      right: 320,
      bottom: 480,
      toJSON: () => ({}),
    })

    return { surface, inner, onInteractionLock }
  }

  const pinchZoomIn = (surface: HTMLElement) => {
    fireEvent.touchStart(surface, {
      touches: [
        { clientX: 100, clientY: 240 },
        { clientX: 200, clientY: 240 },
      ],
    })
    fireEvent.touchMove(surface, {
      touches: [
        { clientX: 60, clientY: 240 },
        { clientX: 260, clientY: 240 },
      ],
    })
    fireEvent.touchEnd(surface, { touches: [] })
  }

  const flushAnimationFrames = () => {
    let callback: FrameRequestCallback | undefined
    while ((callback = rafCallbacks.shift())) {
      callback(0)
    }
  }

  let rafCallbacks: FrameRequestCallback[] = []
  let rafId = 0

  beforeEach(() => {
    rafCallbacks = []
    rafId = 0
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      rafCallbacks.push(callback)
      rafId += 1
      return rafId
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("zooms with a two-finger pinch and locks interaction", () => {
    const { surface, inner, onInteractionLock } = mountPinchZoom()

    pinchZoomIn(surface)

    expect(onInteractionLock).toHaveBeenCalledWith(true)
    expect(inner.style.transform).toMatch(/scale\([2-9]/)
    expect(surface.classList.contains("is-zoomed")).toBe(true)
  })

  it("resets zoom on a single tap when already zoomed in", () => {
    const onInteractionLock = vi.fn()
    const { surface, inner } = mountPinchZoom(onInteractionLock)

    pinchZoomIn(surface)
    onInteractionLock.mockClear()

    fireEvent.touchStart(surface, {
      touches: [{ clientX: 160, clientY: 240 }],
    })
    fireEvent.touchEnd(surface, { touches: [] })

    flushAnimationFrames()
    flushAnimationFrames()

    expect(surface.classList.contains("is-resetting")).toBe(true)
    expect(inner.style.transform).toBe("translate3d(0px, 0px, 0) scale(1)")
    expect(onInteractionLock).toHaveBeenCalledWith(true)

    inner.dispatchEvent(
      new TransitionEvent("transitionend", {
        propertyName: "transform",
        bubbles: true,
      }),
    )

    expect(inner.style.transform).toBe("translate3d(0px, 0px, 0) scale(1)")
    expect(surface.classList.contains("is-zoomed")).toBe(false)
    expect(surface.classList.contains("is-resetting")).toBe(false)
    expect(onInteractionLock).toHaveBeenLastCalledWith(false)
  })

  it("does not reset zoom when the finger moves enough to pan", () => {
    const { surface, inner } = mountPinchZoom()

    pinchZoomIn(surface)

    fireEvent.touchStart(surface, {
      touches: [{ clientX: 160, clientY: 240 }],
    })
    fireEvent.touchMove(surface, {
      touches: [{ clientX: 190, clientY: 240 }],
    })
    fireEvent.touchEnd(surface, { touches: [] })

    expect(inner.style.transform).toMatch(/scale\([2-9]/)
    expect(surface.classList.contains("is-zoomed")).toBe(true)
  })
})
