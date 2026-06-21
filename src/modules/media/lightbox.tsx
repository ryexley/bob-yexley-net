import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js"
import { Dialog, DialogCloseButton } from "@/components/dialog"
import { IconButton } from "@/components/icon-button"
import { PersonalCloudImage } from "@/components/personal-cloud-image"
import { clsx as cx } from "@/util"
import type { BlipMediaRow } from "./data/queries"
import { LightboxPinchZoom } from "./lightbox-pinch-zoom"
import { MediaVariant, originalUrl, variantUrl } from "./media-utils"

export type LightboxLabels = {
  close: string
  previous: string
  next: string
  region: string
  /** e.g. `(2, 8) => "2 / 8"`. */
  counter: (current: number, total: number) => string
}

export type LightboxProps = {
  media: BlipMediaRow[]
  /** Opening index; `null` (or out of range) keeps the lightbox closed. */
  index: number | null
  onClose: () => void
  labels: LightboxLabels
  /** Min-px swipe distance to trigger navigation (mobile). Default 40. */
  swipeThreshold?: number
}

const AXIS_LOCK_PX = 10

const readIsDesktop = (): boolean => {
  if (typeof window === "undefined") {
    return true
  }
  if (typeof window.matchMedia !== "function") {
    // jsdom / SSR — default desktop so layout tests stay stable.
    return true
  }
  return window.matchMedia("(min-width: 768px)").matches
}

type CarouselSlide = {
  record: BlipMediaRow
  slideIndex: number
  key: string
}

const aspectRatio = (record: BlipMediaRow): string | undefined => {
  if (record.width && record.height && record.width > 0 && record.height > 0) {
    return `${record.width} / ${record.height}`
  }
  return undefined
}

/** Whether `(clientX, clientY)` falls on the visible media for `object-fit: contain`. */
export function isClickInsideObjectFitContain(
  clientX: number,
  clientY: number,
  element: HTMLImageElement | HTMLVideoElement,
): boolean {
  const rect = element.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    return false
  }

  const naturalWidth =
    element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth
  const naturalHeight =
    element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight

  // Dimensions unknown while loading — treat as a media hit so we do not dismiss early.
  if (!naturalWidth || !naturalHeight) {
    return true
  }

  const boxRatio = rect.width / rect.height
  const mediaRatio = naturalWidth / naturalHeight

  let renderedWidth: number
  let renderedHeight: number
  let offsetX: number
  let offsetY: number

  if (mediaRatio > boxRatio) {
    renderedWidth = rect.width
    renderedHeight = rect.width / mediaRatio
    offsetX = 0
    offsetY = (rect.height - renderedHeight) / 2
  } else {
    renderedHeight = rect.height
    renderedWidth = rect.height * mediaRatio
    offsetX = (rect.width - renderedWidth) / 2
    offsetY = 0
  }

  return (
    x >= offsetX &&
    x <= offsetX + renderedWidth &&
    y >= offsetY &&
    y <= offsetY + renderedHeight
  )
}

/** One `play()` per navigation — skip if already playing; muted fallback only when paused. */
const playVideoElement = (el: HTMLVideoElement) => {
  if (!el.paused) {
    return
  }

  el.muted = false
  el.currentTime = 0
  const playPromise = el.play()
  if (playPromise === undefined) {
    return
  }
  void playPromise.catch(() => {
    if (!el.paused) {
      return
    }
    el.muted = true
    void el.play()
  })
}

function LightboxSlide(props: {
  slideKey: string
  record: BlipMediaRow
  slideIndex: number
  trackPosition: number
  trackIndex: number
  activeIndex: number
  isDesktop: boolean
  registerVideo: (slideKey: string, el: HTMLVideoElement) => void
  unregisterVideo: (slideKey: string, el: HTMLVideoElement) => void
  onZoomInteractionLock: (locked: boolean) => void
}) {
  const isVisible = () => props.trackPosition === props.trackIndex
  const isActive = () =>
    props.slideIndex === props.activeIndex && isVisible()
  const pinchZoomEnabled = () => !props.isDesktop && isActive()
  const thumbUrl = () => variantUrl(props.record.storage_key, MediaVariant.Thumb)

  const [showControls, setShowControls] = createSignal(false)

  createEffect(() => {
    if (!isVisible()) {
      setShowControls(false)
    }
  })

  const handleVideoActivate = (event: MouseEvent, el: HTMLVideoElement) => {
    if (!isVisible()) {
      return
    }
    event.stopPropagation()
    setShowControls(true)
    if (el.paused) {
      void el.play()
    }
  }

  return (
    <div
      class="lightbox-slide"
      aria-hidden={!isActive()}>
      <div
        class={cx("lightbox-media", {
          "is-zoomable": props.record.media_type === "image" || props.record.media_type === "gif",
        })}
        style={{ "aspect-ratio": aspectRatio(props.record) }}>
        <Show when={props.record.media_type === "image"}>
          <LightboxPinchZoom
            enabled={pinchZoomEnabled()}
            onInteractionLock={props.onZoomInteractionLock}>
            <PersonalCloudImage
              imageKey={props.record.storage_key}
              mimeType={props.record.mime_type}
              processingStatus={
                props.record.processing_status as "pending" | "complete" | "failed"
              }
              variant={props.isDesktop ? MediaVariant.Large : MediaVariant.Medium}
              objectFit="contain"
              eager={isActive()}
              fadeIn={false}
              class="lightbox-image"
            />
          </LightboxPinchZoom>
        </Show>
        <Show when={props.record.media_type === "gif"}>
          <LightboxPinchZoom
            enabled={pinchZoomEnabled()}
            onInteractionLock={props.onZoomInteractionLock}>
            <img
              class="lightbox-gif"
              src={originalUrl(props.record.storage_key, props.record.mime_type)}
              alt=""
            />
          </LightboxPinchZoom>
        </Show>
        <Show when={props.record.media_type === "video"}>
          <div class="lightbox-video-wrap">
            <Show when={!isVisible()}>
              <img
                class="lightbox-video-poster"
                src={thumbUrl()}
                alt=""
              />
            </Show>
            <video
              ref={el => {
                if (!el) {
                  return
                }
                props.registerVideo(props.slideKey, el)
                onCleanup(() => props.unregisterVideo(props.slideKey, el))
              }}
              class={cx("lightbox-video", !isVisible() && "is-offscreen")}
              src={originalUrl(props.record.storage_key, props.record.mime_type)}
              width={props.record.width ?? undefined}
              height={props.record.height ?? undefined}
              controls={showControls() && isVisible()}
              playsinline
              preload="auto"
              onClick={event => {
                if (event.currentTarget instanceof HTMLVideoElement) {
                  handleVideoActivate(event, event.currentTarget)
                }
              }}>
              <track kind="captions" />
            </video>
          </div>
        </Show>
      </div>
    </div>
  )
}

/**
 * Full-media viewer (spec §7): desktop centered modal with flanking arrow
 * buttons + keyboard nav; mobile full-bleed with swipe. A single responsive
 * component — only the chrome differs between breakpoints; the carousel index
 * state, keyboard handling, and video pause-on-navigate are shared.
 *
 * Hand-rolled over the Kobalte `Dialog` (focus trap + overlay) rather
 * than a carousel lib: a lightbox is discrete page-snap viewing with wrapping
 * navigation (last → first, first → last), dependency-free, and unit testable
 * in jsdom (no layout measurement needed).
 *
 * Mobile gestures on the stage: horizontal drag moves the carousel track with
 * the finger and snaps on release; dominant vertical swipe (up or down)
 * dismisses. Pinch-to-zoom on still images (and GIFs) locks carousel/dismiss
 * gestures while zoomed or pinching; one-finger pan applies when zoomed in.
 */
type LightboxContentProps = {
  initialIndex: number
  media: BlipMediaRow[]
  onClose: () => void
  labels: LightboxLabels
  swipeThreshold?: number
}

function LightboxContent(props: LightboxContentProps) {
  const swipeThreshold = () => props.swipeThreshold ?? 40

  const [active, setActive] = createSignal(props.initialIndex)
  const [trackIndex, setTrackIndex] = createSignal(
    props.media.length > 1 ? props.initialIndex + 1 : 0,
  )
  const [isDesktop, setIsDesktop] = createSignal(readIsDesktop())
  const [dragOffsetX, setDragOffsetX] = createSignal(0)
  const [dragOffsetY, setDragOffsetY] = createSignal(0)
  const [isDragging, setIsDragging] = createSignal(false)
  const [transitionEnabled, setTransitionEnabled] = createSignal(true)
  const [zoomGestureLocked, setZoomGestureLocked] = createSignal(false)

  const total = createMemo(() => props.media.length)
  const canWrapNavigate = createMemo(() => total() > 1)

  const carouselSlides = createMemo((): CarouselSlide[] => {
    const items = props.media
    if (items.length <= 1) {
      return items.map((record, slideIndex) => ({
        record,
        slideIndex,
        key: record.id,
      }))
    }

    const lastIndex = items.length - 1
    return [
      {
        record: items[lastIndex]!,
        slideIndex: lastIndex,
        key: `${items[lastIndex]!.id}-clone-leading`,
      },
      ...items.map((record, slideIndex) => ({
        record,
        slideIndex,
        key: record.id,
      })),
      {
        record: items[0]!,
        slideIndex: 0,
        key: `${items[0]!.id}-clone-trailing`,
      },
    ]
  })

  onMount(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      queueMicrotask(() => playVideoForTrack(trackIndex()))
      return
    }
    const queryList = window.matchMedia("(min-width: 768px)")
    const sync = () => setIsDesktop(queryList.matches)
    sync()
    queryList.addEventListener("change", sync)
    queueMicrotask(() => playVideoForTrack(trackIndex()))
    onCleanup(() => queryList.removeEventListener("change", sync))
  })

  const trackTransform = createMemo(() => {
    const dragX = !isDesktop() ? dragOffsetX() : 0
    return `translateX(calc(-100% * ${trackIndex()} + ${dragX}px))`
  })

  const stageTransform = createMemo(() => {
    const dragY = !isDesktop() ? dragOffsetY() : 0
    if (dragY === 0) {
      return undefined
    }
    return `translateY(${dragY}px)`
  })

  const videoBySlideKey = new Map<string, HTMLVideoElement>()

  const registerVideo = (slideKey: string, el: HTMLVideoElement) => {
    videoBySlideKey.set(slideKey, el)
  }

  const unregisterVideo = (slideKey: string, el: HTMLVideoElement) => {
    if (videoBySlideKey.get(slideKey) === el) {
      videoBySlideKey.delete(slideKey)
    }
  }

  const playVideoForTrack = (track: number) => {
    const slide = carouselSlides()[track]
    if (!slide || slide.record.media_type !== "video") {
      return
    }
    const el = videoBySlideKey.get(slide.key)
    if (el) {
      playVideoElement(el)
    }
  }

  const pauseAllVideos = () => {
    for (const video of videoBySlideKey.values()) {
      if (!video.paused) {
        video.pause()
      }
    }
  }

  onCleanup(() => {
    pauseAllVideos()
  })

  const navigateTo = (nextActive: number, nextTrack: number) => {
    pauseAllVideos()
    setZoomGestureLocked(false)
    setActive(nextActive)
    setTrackIndex(nextTrack)
    playVideoForTrack(nextTrack)
  }

  const goPrevious = () => {
    if (!canWrapNavigate()) {
      return
    }
    const count = total()
    const current = active()
    const track = trackIndex()
    if (current === 0) {
      navigateTo(count - 1, 0)
      return
    }
    navigateTo(current - 1, track - 1)
  }

  const goNext = () => {
    if (!canWrapNavigate()) {
      return
    }
    const count = total()
    const current = active()
    const track = trackIndex()
    if (current === count - 1) {
      navigateTo(0, count + 1)
      return
    }
    navigateTo(current + 1, track + 1)
  }

  const jumpTrackIndex = (index: number) => {
    setTransitionEnabled(false)
    setTrackIndex(index)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionEnabled(true)
      })
    })
  }

  const handleTrackTransitionEnd = (event: TransitionEvent) => {
    if (event.propertyName !== "transform" || isDragging() || !canWrapNavigate()) {
      return
    }

    const count = total()
    const index = trackIndex()
    if (index === 0) {
      jumpTrackIndex(count)
      playVideoForTrack(count)
    } else if (index === count + 1) {
      jumpTrackIndex(1)
      playVideoForTrack(1)
    }
  }

  const closeLightbox = () => {
    pauseAllVideos()
    props.onClose()
  }

  const shouldIgnoreBackdropClose = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return false
    }

    if (target.closest(".lightbox-nav, .lightbox-close, .lightbox-indicator")) {
      return true
    }

    if (target.closest(".lightbox-video-wrap")) {
      return true
    }

    const media = target.closest("img, video")
    if (
      media instanceof HTMLImageElement &&
      media.closest(".lightbox") &&
      isClickInsideObjectFitContain(event.clientX, event.clientY, media)
    ) {
      return true
    }

    if (
      media instanceof HTMLVideoElement &&
      media.closest(".lightbox") &&
      isClickInsideObjectFitContain(event.clientX, event.clientY, media)
    ) {
      return true
    }

    return false
  }

  const handleLightboxBackdropClick = (event: MouseEvent) => {
    if (shouldIgnoreBackdropClose(event)) {
      return
    }

    closeLightbox()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeLightbox()
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      goPrevious()
      return
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      goNext()
    }
  }

  // Document listener so Escape/arrows work when focus is on `<video>` controls.
  onMount(() => {
    document.addEventListener("keydown", handleKeyDown)
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown))
  })

  let pointerStartX = 0
  let pointerStartY = 0
  let gestureAxis: "none" | "x" | "y" = "none"

  const resetGesture = () => {
    pointerStartX = 0
    pointerStartY = 0
    gestureAxis = "none"
    setDragOffsetX(0)
    setDragOffsetY(0)
    setIsDragging(false)
  }

  const resolveGestureAxis = (deltaX: number, deltaY: number): "none" | "x" | "y" => {
    if (gestureAxis !== "none") {
      return gestureAxis
    }

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < AXIS_LOCK_PX) {
      return "none"
    }

    return Math.abs(deltaX) >= Math.abs(deltaY) ? "x" : "y"
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (isDesktop() || zoomGestureLocked()) {
      return
    }

    pointerStartX = event.clientX
    pointerStartY = event.clientY
    gestureAxis = "none"
    setDragOffsetX(0)
    setDragOffsetY(0)
    setIsDragging(true)

    if (event.currentTarget instanceof HTMLElement && "setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging() || zoomGestureLocked()) {
      return
    }

    const deltaX = event.clientX - pointerStartX
    const deltaY = event.clientY - pointerStartY
    const axis = resolveGestureAxis(deltaX, deltaY)

    if (axis === "none") {
      return
    }

    gestureAxis = axis

    if (axis === "x") {
      setDragOffsetX(deltaX)
      setDragOffsetY(0)
      event.preventDefault()
      return
    }

    setDragOffsetY(deltaY)
    setDragOffsetX(0)
    event.preventDefault()
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (!isDragging() || zoomGestureLocked()) {
      return
    }

    const deltaX = event.clientX - pointerStartX
    const deltaY = event.clientY - pointerStartY
    const axis = resolveGestureAxis(deltaX, deltaY)
    const threshold = swipeThreshold()

    setIsDragging(false)
    setDragOffsetX(0)
    setDragOffsetY(0)
    gestureAxis = "none"

    if (axis === "y") {
      if (Math.abs(deltaY) >= threshold) {
        closeLightbox()
      }
      return
    }

    if (axis === "x" && canWrapNavigate()) {
      if (deltaX <= -threshold) {
        goNext()
      } else if (deltaX >= threshold) {
        goPrevious()
      }
    }
  }

  const handlePointerCancel = () => {
    resetGesture()
  }

  return (
    <div
      class={cx("lightbox", { "is-desktop": isDesktop(), "is-mobile": !isDesktop() })}
      role="group"
      aria-label={props.labels.region}
      aria-roledescription="carousel"
      tabindex="-1"
      onClick={handleLightboxBackdropClick}>
      <Show when={isDesktop() && canWrapNavigate()}>
        <IconButton
          class="lightbox-nav lightbox-nav-previous"
          icon="chevron_left"
          aria-label={props.labels.previous}
          onClick={goPrevious}
        />
      </Show>

      <div
        class={cx("lightbox-stage", {
          "is-dragging": isDragging(),
          "is-zoom-locked": zoomGestureLocked(),
        })}
        style={{ transform: stageTransform() }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}>
        <div
          class={cx("lightbox-track", {
            "is-dragging": isDragging(),
            "no-transition": !transitionEnabled(),
          })}
          style={{ transform: trackTransform() }}
          onTransitionEnd={handleTrackTransitionEnd}>
          <For each={carouselSlides()}>
            {(slide, trackPosition) => (
              <LightboxSlide
                slideKey={slide.key}
                record={slide.record}
                slideIndex={slide.slideIndex}
                trackPosition={trackPosition()}
                trackIndex={trackIndex()}
                activeIndex={active()}
                isDesktop={isDesktop()}
                registerVideo={registerVideo}
                unregisterVideo={unregisterVideo}
                onZoomInteractionLock={setZoomGestureLocked}
              />
            )}
          </For>
        </div>
      </div>

      <Show when={isDesktop() && canWrapNavigate()}>
        <IconButton
          class="lightbox-nav lightbox-nav-next"
          icon="chevron_right"
          aria-label={props.labels.next}
          onClick={goNext}
        />
      </Show>

      <Show when={total() > 1}>
        <div class="lightbox-indicator">
          <span class="lightbox-counter">
            {props.labels.counter(active() + 1, total())}
          </span>
          <div
            class="lightbox-dots"
            aria-hidden="true">
            <For each={props.media}>
              {(_, dotIndex) => (
                <span
                  class={cx("lightbox-dot", {
                    "is-active": dotIndex() === active(),
                  })}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      <DialogCloseButton
        class="lightbox-close"
        aria-label={props.labels.close}
      />
    </div>
  )
}

export function Lightbox(props: LightboxProps) {
  const isOpen = createMemo(
    () =>
      props.index != null &&
      props.index >= 0 &&
      props.index < props.media.length,
  )

  const closeLightbox = () => {
    props.onClose()
  }

  return (
    <Dialog
      open={isOpen()}
      onOpenChange={open => {
        if (!open) {
          closeLightbox()
        }
      }}
      modal
      preventScroll
      overlayClass="lightbox-overlay"
      class="lightbox-dialog">
      <Show when={isOpen()}>
        {() => (
          <LightboxContent
            initialIndex={props.index!}
            media={props.media}
            labels={props.labels}
            swipeThreshold={props.swipeThreshold}
            onClose={closeLightbox}
          />
        )}
      </Show>
    </Dialog>
  )
}
