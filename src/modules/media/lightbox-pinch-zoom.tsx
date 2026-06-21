import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type ParentProps,
} from "solid-js"
import { clsx as cx } from "@/util"

export const MIN_PINCH_SCALE = 1
export const MAX_PINCH_SCALE = 4
const SCALE_SNAP_EPSILON = 0.04
/** Movement above this cancels a tap-to-reset and begins one-finger pan. */
export const TAP_RESET_MOVE_THRESHOLD_PX = 10
export const PINCH_RESET_TRANSITION_MS = 250

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

type TouchPoint = Pick<Touch, "clientX" | "clientY">

export const pinchDistance = (touches: TouchPoint[]): number => {
  if (touches.length < 2) {
    return 0
  }
  const dx = touches[0]!.clientX - touches[1]!.clientX
  const dy = touches[0]!.clientY - touches[1]!.clientY
  return Math.hypot(dx, dy)
}

export const pinchCenter = (touches: TouchPoint[]): { x: number; y: number } => ({
  x: (touches[0]!.clientX + touches[1]!.clientX) / 2,
  y: (touches[0]!.clientY + touches[1]!.clientY) / 2,
})

export const isPinchZoomed = (scale: number): boolean =>
  scale > MIN_PINCH_SCALE + SCALE_SNAP_EPSILON

type PinchZoomTransform = {
  scale: number
  x: number
  y: number
}

export const clampPinchPan = (
  transform: PinchZoomTransform,
  containerWidth: number,
  containerHeight: number,
): PinchZoomTransform => {
  const maxPanX = Math.max(0, ((transform.scale - 1) * containerWidth) / 2)
  const maxPanY = Math.max(0, ((transform.scale - 1) * containerHeight) / 2)
  return {
    scale: transform.scale,
    x: clamp(transform.x, -maxPanX, maxPanX),
    y: clamp(transform.y, -maxPanY, maxPanY),
  }
}

export const snapPinchTransform = (
  transform: PinchZoomTransform,
  containerWidth: number,
  containerHeight: number,
): PinchZoomTransform => {
  if (!isPinchZoomed(transform.scale)) {
    return { scale: MIN_PINCH_SCALE, x: 0, y: 0 }
  }
  return clampPinchPan(transform, containerWidth, containerHeight)
}

export type LightboxPinchZoomProps = ParentProps<{
  enabled: boolean
  class?: string
  onInteractionLock: (locked: boolean) => void
}>

/**
 * Mobile pinch-to-zoom + one-finger pan for still images in the lightbox.
 * Carousel swipe / vertical dismiss on the stage are suppressed while zoomed
 * or during an active pinch gesture (`onInteractionLock`).
 */
export function LightboxPinchZoom(props: LightboxPinchZoomProps) {
  let surface: HTMLDivElement | undefined
  let inner: HTMLDivElement | undefined

  const [transform, setTransform] = createSignal<PinchZoomTransform>({
    scale: MIN_PINCH_SCALE,
    x: 0,
    y: 0,
  })
  const [isResetting, setIsResetting] = createSignal(false)

  let lastPinchDistance = 0
  let panPointerStart = { x: 0, y: 0 }
  let panTransformStart = { x: 0, y: 0 }
  let tapCandidate: { x: number; y: number } | null = null
  let isPinching = false
  let isPanning = false
  let resetAnimationCleanup: (() => void) | null = null

  const cssTransform = createMemo(() => {
    const { scale, x, y } = transform()
    return `translate3d(${x}px, ${y}px, 0) scale(${scale})`
  })

  const syncInteractionLock = (next: PinchZoomTransform) => {
    props.onInteractionLock(
      isPinching || isPanning || isResetting() || isPinchZoomed(next.scale),
    )
  }

  const cancelResetAnimation = () => {
    resetAnimationCleanup?.()
    resetAnimationCleanup = null
    setIsResetting(false)
  }

  const finishResetAnimation = (notifyUnlock: boolean) => {
    cancelResetAnimation()
    setTransform({ scale: MIN_PINCH_SCALE, x: 0, y: 0 })
    if (notifyUnlock) {
      props.onInteractionLock(false)
    }
  }

  const readContainerSize = () => ({
    width: surface?.clientWidth ?? 0,
    height: surface?.clientHeight ?? 0,
  })

  const applyTransform = (next: PinchZoomTransform) => {
    const { width, height } = readContainerSize()
    const clamped =
      width > 0 && height > 0
        ? clampPinchPan(next, width, height)
        : next
    setTransform(clamped)
    syncInteractionLock(clamped)
  }

  const resetTransform = (notifyUnlock = true) => {
    isPinching = false
    isPanning = false
    lastPinchDistance = 0
    tapCandidate = null
    cancelResetAnimation()
    setTransform({ scale: MIN_PINCH_SCALE, x: 0, y: 0 })
    if (notifyUnlock) {
      props.onInteractionLock(false)
    }
  }

  const animateResetTransform = () => {
    if (!inner || !isPinchZoomed(transform().scale)) {
      resetTransform()
      return
    }

    isPinching = false
    isPanning = false
    lastPinchDistance = 0
    tapCandidate = null
    cancelResetAnimation()
    props.onInteractionLock(true)
    setIsResetting(true)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!inner) {
          finishResetAnimation(true)
          return
        }

        setTransform({ scale: MIN_PINCH_SCALE, x: 0, y: 0 })

        const complete = () => {
          finishResetAnimation(true)
        }

        const onTransitionEnd = (event: TransitionEvent) => {
          if (event.target !== inner || event.propertyName !== "transform") {
            return
          }
          complete()
        }

        const fallbackTimer = window.setTimeout(
          complete,
          PINCH_RESET_TRANSITION_MS + 50,
        )

        resetAnimationCleanup = () => {
          inner?.removeEventListener("transitionend", onTransitionEnd)
          window.clearTimeout(fallbackTimer)
        }

        inner.addEventListener("transitionend", onTransitionEnd)
      })
    })
  }

  createEffect(() => {
    if (!props.enabled) {
      resetTransform(false)
    }
  })

  const handleTouchStart = (event: TouchEvent) => {
    if (!props.enabled || !surface || isResetting()) {
      return
    }

    const touches = Array.from(event.touches)

    if (touches.length === 2) {
      isPinching = true
      isPanning = false
      tapCandidate = null
      lastPinchDistance = pinchDistance(touches)
      props.onInteractionLock(true)
      return
    }

    if (touches.length === 1 && isPinchZoomed(transform().scale)) {
      isPinching = false
      tapCandidate = {
        x: touches[0]!.clientX,
        y: touches[0]!.clientY,
      }
      panPointerStart = {
        x: touches[0]!.clientX,
        y: touches[0]!.clientY,
      }
      panTransformStart = {
        x: transform().x,
        y: transform().y,
      }
      syncInteractionLock(transform())
    }
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (!props.enabled || !surface || isResetting()) {
      return
    }

    const touches = Array.from(event.touches)

    if (touches.length === 2) {
      event.preventDefault()
      const distance = pinchDistance(touches)
      if (lastPinchDistance <= 0 || distance <= 0) {
        lastPinchDistance = distance
        return
      }

      const center = pinchCenter(touches)
      const rect = surface.getBoundingClientRect()
      const focalX = center.x - rect.left - rect.width / 2
      const focalY = center.y - rect.top - rect.height / 2
      const scaleFactor = distance / lastPinchDistance
      const current = transform()
      const nextScale = clamp(
        current.scale * scaleFactor,
        MIN_PINCH_SCALE,
        MAX_PINCH_SCALE,
      )

      applyTransform({
        scale: nextScale,
        x: current.x - focalX * (scaleFactor - 1),
        y: current.y - focalY * (scaleFactor - 1),
      })
      lastPinchDistance = distance
      return
    }

    if (
      touches.length === 1 &&
      tapCandidate &&
      !isPanning &&
      isPinchZoomed(transform().scale)
    ) {
      const touch = touches[0]!
      const moved = Math.hypot(
        touch.clientX - tapCandidate.x,
        touch.clientY - tapCandidate.y,
      )
      if (moved > TAP_RESET_MOVE_THRESHOLD_PX) {
        isPanning = true
        tapCandidate = null
        panPointerStart = {
          x: touch.clientX,
          y: touch.clientY,
        }
        panTransformStart = {
          x: transform().x,
          y: transform().y,
        }
        props.onInteractionLock(true)
      }
    }

    if (touches.length === 1 && isPanning && isPinchZoomed(transform().scale)) {
      event.preventDefault()
      const touch = touches[0]!
      applyTransform({
        scale: transform().scale,
        x: panTransformStart.x + (touch.clientX - panPointerStart.x),
        y: panTransformStart.y + (touch.clientY - panPointerStart.y),
      })
    }
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (!props.enabled || isResetting()) {
      return
    }

    if (event.touches.length >= 2) {
      return
    }

    if (event.touches.length === 1 && isPinching) {
      isPinching = false
      lastPinchDistance = pinchDistance(Array.from(event.touches))
      tapCandidate = null
      if (isPinchZoomed(transform().scale)) {
        isPanning = true
        panPointerStart = {
          x: event.touches[0]!.clientX,
          y: event.touches[0]!.clientY,
        }
        panTransformStart = {
          x: transform().x,
          y: transform().y,
        }
      }
      return
    }

    if (
      event.touches.length === 0 &&
      tapCandidate &&
      !isPanning &&
      !isPinching &&
      isPinchZoomed(transform().scale)
    ) {
      animateResetTransform()
      return
    }

    tapCandidate = null
    isPinching = false
    isPanning = false
    lastPinchDistance = 0

    const { width, height } = readContainerSize()
    const snapped = snapPinchTransform(transform(), width, height)
    setTransform(snapped)
    syncInteractionLock(snapped)
  }

  createEffect(() => {
    const node = surface
    if (!node || !props.enabled) {
      return
    }

    node.addEventListener("touchstart", handleTouchStart, { passive: true })
    node.addEventListener("touchmove", handleTouchMove, { passive: false })
    node.addEventListener("touchend", handleTouchEnd, { passive: true })
    node.addEventListener("touchcancel", handleTouchEnd, { passive: true })

    onCleanup(() => {
      node.removeEventListener("touchstart", handleTouchStart)
      node.removeEventListener("touchmove", handleTouchMove)
      node.removeEventListener("touchend", handleTouchEnd)
      node.removeEventListener("touchcancel", handleTouchEnd)
    })
  })

  onCleanup(() => {
    cancelResetAnimation()
    if (props.enabled) {
      props.onInteractionLock(false)
    }
  })

  return (
    <div
      ref={surface}
      class={cx("lightbox-pinch-zoom", props.class, {
        "is-zoomed": isPinchZoomed(transform().scale) || isResetting(),
        "is-pinch-active": isPinching || isPanning,
        "is-resetting": isResetting(),
      })}>
      <div
        ref={inner}
        class="lightbox-pinch-zoom-inner"
        style={{ transform: cssTransform() }}>
        {props.children}
      </div>
    </div>
  )
}
