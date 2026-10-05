import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
} from "solid-js"
import { Dialog, DialogCloseButton } from "@/components/dialog"
import { LoadingSpinner } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { PersonalCloudImage } from "@/components/personal-cloud-image"
import { ptr } from "@/i18n"
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

const tr = ptr("shared.components.lightbox")

const AXIS_LOCK_PX = 10
/** Native `<video controls>` chrome sits along the bottom of the element box. */
export const VIDEO_CONTROL_CHROME_RATIO = 0.28
export const VIDEO_CONTROL_CHROME_MIN_PX = 56
/** Above this count, dots become an unreadable strip — switch to chevron paging. */
export const LIGHTBOX_DOT_PAGER_MAX = 15

const readIsDesktop = (): boolean => {
  if (typeof window === "undefined") {
    return true
  }
  if (typeof window.matchMedia !== "function") {
    // jsdom / SSR — default desktop so layout tests stay stable.
    return true
  }
  return window.matchMedia("(min-width: 48rem)").matches
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
    element instanceof HTMLVideoElement
      ? element.videoWidth
      : element.naturalWidth
  const naturalHeight =
    element instanceof HTMLVideoElement
      ? element.videoHeight
      : element.naturalHeight

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

export function isVideoControlChromeHit(
  clientX: number,
  clientY: number,
  video: HTMLVideoElement,
): boolean {
  const rect = video.getBoundingClientRect()
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return false
  }

  const chromeHeight = Math.max(
    VIDEO_CONTROL_CHROME_MIN_PX,
    rect.height * VIDEO_CONTROL_CHROME_RATIO,
  )
  return clientY >= rect.bottom - chromeHeight
}

const videoFromEvent = (
  event: PointerEvent | MouseEvent,
): HTMLVideoElement | null => {
  const path =
    typeof event.composedPath === "function" ? event.composedPath() : []
  for (const node of path) {
    if (node instanceof HTMLVideoElement) {
      return node
    }
  }

  const target = event.target
  if (target instanceof HTMLVideoElement) {
    return target
  }
  if (target instanceof Element) {
    return target.closest("video")
  }
  return null
}

/** True when this pointer is aimed at native play/pause/scrub chrome. */
export function eventTargetsVideoControlChrome(
  event: PointerEvent | MouseEvent,
): boolean {
  const video = videoFromEvent(event)
  if (!video?.controls) {
    return false
  }
  return isVideoControlChromeHit(event.clientX, event.clientY, video)
}

/**
 * Only the visible slide's `<video>` holds a `src`. Every other video slide
 * keeps its URL in `data-src` with `preload="none"`, so opening a lightbox over
 * a page with N videos fetches one file instead of N full downloads (all
 * slides used to mount with `src` + `preload="auto"`).
 */
export const attachVideoSource = (el: HTMLVideoElement) => {
  const src = el.dataset.src
  if (!src || el.getAttribute("src") === src) {
    return
  }
  el.preload = "auto"
  el.setAttribute("src", src)
}

/**
 * Pause, drop `src` and `load()` so the browser aborts the fetch and frees the
 * decoder/buffer (removing the attribute alone keeps the old resource alive).
 */
export const releaseVideoSource = (el: HTMLVideoElement) => {
  if (!el.hasAttribute("src")) {
    return
  }
  try {
    el.pause()
  } catch {
    // jsdom: not implemented
  }
  el.preload = "none"
  el.removeAttribute("src")
  try {
    el.load()
  } catch {
    // jsdom: not implemented
  }
}

/** One `play()` per navigation — skip if already playing; muted fallback only when paused. */
const playVideoElement = (el: HTMLVideoElement) => {
  attachVideoSource(el)
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

/**
 * Centered spinner + polite live-region label shown over a slide while its
 * media is loading (or a playing video is buffering).
 */
function LightboxLoadingOverlay(props: { label: string }) {
  return (
    <div
      class="lightbox-loading"
      role="status"
      aria-live="polite">
      <span class="lightbox-loading-badge">
        <LoadingSpinner
          class="lightbox-loading-spinner"
          size="2.25rem"
          aria-hidden="true"
        />
      </span>
      <span class="sr-only">{props.label}</span>
    </div>
  )
}

/**
 * `idle`: no `src` (off-screen slide). `loading`: `src` attached, no frame yet.
 * `ready`: a frame is decoded / playing. `buffering`: ran dry mid-play.
 */
export type LightboxVideoState =
  | "idle"
  | "loading"
  | "ready"
  | "buffering"
  | "error"

/** `HTMLMediaElement.HAVE_CURRENT_DATA` — a frame is available to show. */
const HAVE_CURRENT_DATA = 2
/** `HTMLMediaElement.HAVE_FUTURE_DATA` — enough to keep playing for now. */
const HAVE_FUTURE_DATA = 3

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
  const isActive = () => props.slideIndex === props.activeIndex && isVisible()
  const pinchZoomEnabled = () => !props.isDesktop && isActive()
  const thumbUrl = () =>
    variantUrl(props.record.storage_key, MediaVariant.Thumb)

  const [showControls, setShowControls] = createSignal(false)

  createEffect(() => {
    if (!isVisible()) {
      setShowControls(false)
    }
  })

  const [videoState, setVideoState] = createSignal<LightboxVideoState>("idle")
  const [posterFailed, setPosterFailed] = createSignal(false)

  let videoEl: HTMLVideoElement | undefined
  createEffect(() => {
    const visible = isVisible()
    const el = videoEl
    if (!el) {
      return
    }
    if (visible) {
      attachVideoSource(el)
      setVideoState(el.readyState >= HAVE_CURRENT_DATA ? "ready" : "loading")
    } else {
      releaseVideoSource(el)
      setVideoState("idle")
    }
  })

  /** Only react to media events while this slide owns a `src`. */
  const videoHasSource = (event: Event) =>
    event.currentTarget instanceof HTMLVideoElement &&
    event.currentTarget.hasAttribute("src")

  const markVideoReady = (event: Event) => {
    if (videoHasSource(event)) {
      setVideoState("ready")
    }
  }

  const markVideoBuffering = (event: Event) => {
    if (!videoHasSource(event)) {
      return
    }
    const el = event.currentTarget as HTMLVideoElement
    // `stalled` also fires while a fully buffered clip idles; only treat it
    // as buffering when playback can't actually continue.
    if (event.type === "stalled" && el.readyState >= HAVE_FUTURE_DATA) {
      return
    }
    setVideoState(state =>
      state === "error" ? state : state === "ready" ? "buffering" : "loading",
    )
  }

  const markVideoError = (event: Event) => {
    if (videoHasSource(event)) {
      setVideoState("error")
    }
  }

  const retryVideo = (event: MouseEvent) => {
    event.stopPropagation()
    const el = videoEl
    if (!el) {
      return
    }
    setVideoState("loading")
    releaseVideoSource(el)
    playVideoElement(el)
  }

  const showVideoPoster = () =>
    !posterFailed() &&
    (!isVisible() || videoState() === "loading" || videoState() === "error")
  const showVideoSpinner = () =>
    isVisible() && (videoState() === "loading" || videoState() === "buffering")

  const [imageLoaded, setImageLoaded] = createSignal(false)
  const [imageFailed, setImageFailed] = createSignal(false)
  const [imageBackdropFailed, setImageBackdropFailed] = createSignal(false)
  const imageBackdropUrl = () =>
    props.record.processing_status === "complete"
      ? variantUrl(props.record.storage_key, MediaVariant.Micro)
      : undefined
  const isLightboxImage = (target: EventTarget | null) =>
    target instanceof HTMLImageElement &&
    target.classList.contains("personal-cloud-image-img")

  /**
   * `PersonalCloudImage` owns its `<img>` (and walks fallback candidates on
   * 404), so watch its load/error from the frame in the capture phase —
   * neither event bubbles.
   */
  const bindImageFrame = (frame: HTMLDivElement) => {
    const onLoad = (event: Event) => {
      if (isLightboxImage(event.target)) {
        setImageFailed(false)
        setImageLoaded(true)
      }
    }
    const onError = (event: Event) => {
      if (!isLightboxImage(event.target)) {
        return
      }
      setImageLoaded(false)
      // The component swaps to the next candidate or, once exhausted, removes
      // the `<img>` and shows its own error placeholder.
      queueMicrotask(() => {
        if (!frame.querySelector("img.personal-cloud-image-img")) {
          setImageFailed(true)
        }
      })
    }
    frame.addEventListener("load", onLoad, true)
    frame.addEventListener("error", onError, true)
    onCleanup(() => {
      frame.removeEventListener("load", onLoad, true)
      frame.removeEventListener("error", onError, true)
    })
    queueMicrotask(() => {
      const img = frame.querySelector(
        "img.personal-cloud-image-img",
      ) as HTMLImageElement | null
      if (img?.complete && img.naturalWidth > 0) {
        setImageLoaded(true)
      }
    })
  }
  const showImageSpinner = () =>
    isActive() &&
    props.record.processing_status !== "pending" &&
    !imageLoaded() &&
    !imageFailed()

  const handleVideoActivate = (event: MouseEvent, el: HTMLVideoElement) => {
    if (!isVisible()) {
      return
    }
    event.stopPropagation()
    if (showControls()) {
      return
    }
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
          "is-zoomable":
            props.record.media_type === "image" ||
            props.record.media_type === "gif",
        })}
        style={{ "aspect-ratio": aspectRatio(props.record) }}>
        <Show when={props.record.media_type === "image"}>
          <LightboxPinchZoom
            enabled={pinchZoomEnabled()}
            onInteractionLock={props.onZoomInteractionLock}>
            <div
              ref={bindImageFrame}
              class={cx("lightbox-image-frame", {
                "is-loading": !imageLoaded(),
              })}
              aria-busy={showImageSpinner()}>
              <Show
                when={
                  !imageLoaded() && !imageBackdropFailed() && imageBackdropUrl()
                }>
                {url => (
                  <img
                    class="lightbox-image-backdrop"
                    src={url()}
                    alt=""
                    aria-hidden="true"
                    onError={() => setImageBackdropFailed(true)}
                  />
                )}
              </Show>
              <PersonalCloudImage
                imageKey={props.record.storage_key}
                mimeType={props.record.mime_type}
                processingStatus={
                  props.record.processing_status as
                    | "pending"
                    | "complete"
                    | "failed"
                }
                variant={
                  props.isDesktop ? MediaVariant.Large : MediaVariant.Medium
                }
                intrinsicWidth={props.record.width}
                intrinsicHeight={props.record.height}
                objectFit="contain"
                eager={isActive()}
                fadeIn={false}
                class="lightbox-image"
              />
              <Show when={showImageSpinner()}>
                <LightboxLoadingOverlay label={tr("loadingImage")} />
              </Show>
            </div>
          </LightboxPinchZoom>
        </Show>
        <Show when={props.record.media_type === "gif"}>
          <LightboxPinchZoom
            enabled={pinchZoomEnabled()}
            onInteractionLock={props.onZoomInteractionLock}>
            <img
              class="lightbox-gif"
              src={originalUrl(
                props.record.storage_key,
                props.record.mime_type,
              )}
              alt=""
            />
          </LightboxPinchZoom>
        </Show>
        <Show when={props.record.media_type === "video"}>
          <div
            class="lightbox-video-wrap"
            data-video-state={videoState()}
            aria-busy={showVideoSpinner()}>
            <Show when={showVideoPoster()}>
              <img
                class="lightbox-video-poster"
                src={thumbUrl()}
                alt=""
                aria-hidden="true"
                onError={() => setPosterFailed(true)}
              />
            </Show>
            <video
              ref={el => {
                if (!el) {
                  return
                }
                videoEl = el
                props.registerVideo(props.slideKey, el)
                onCleanup(() => {
                  props.unregisterVideo(props.slideKey, el)
                  releaseVideoSource(el)
                })
              }}
              class={cx("lightbox-video", !isVisible() && "is-offscreen")}
              data-src={originalUrl(
                props.record.storage_key,
                props.record.mime_type,
              )}
              poster={thumbUrl()}
              width={props.record.width ?? undefined}
              height={props.record.height ?? undefined}
              controls={showControls() && isVisible()}
              playsinline
              preload="none"
              onLoadedData={markVideoReady}
              onCanPlay={markVideoReady}
              onPlaying={markVideoReady}
              onWaiting={markVideoBuffering}
              onStalled={markVideoBuffering}
              onError={markVideoError}
              onClick={event => {
                if (event.currentTarget instanceof HTMLVideoElement) {
                  handleVideoActivate(event, event.currentTarget)
                }
              }}>
              <track kind="captions" />
            </video>
            <Show when={showVideoSpinner()}>
              <LightboxLoadingOverlay label={tr("loadingVideo")} />
            </Show>
            <Show when={isVisible() && videoState() === "error"}>
              <div
                class="lightbox-video-error"
                role="alert">
                <p class="lightbox-video-error-message">{tr("videoError")}</p>
                <button
                  type="button"
                  class="lightbox-video-retry"
                  onPointerDown={event => event.stopPropagation()}
                  onClick={retryVideo}>
                  {tr("retry")}
                </button>
              </div>
            </Show>
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

  const [active, setActive] = createSignal(untrack(() => props.initialIndex))
  const [trackIndex, setTrackIndex] = createSignal(
    untrack(() => (props.media.length > 1 ? props.initialIndex + 1 : 0)),
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
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      // oxlint-disable-next-line solid/reactivity
      queueMicrotask(() => playVideoForTrack(trackIndex()))
      return
    }
    const queryList = window.matchMedia("(min-width: 48rem)")
    const sync = () => setIsDesktop(queryList.matches)
    sync()
    queryList.addEventListener("change", sync)
    // oxlint-disable-next-line solid/reactivity
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
    if (
      event.propertyName !== "transform" ||
      isDragging() ||
      !canWrapNavigate()
    ) {
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

    if (
      target.closest(
        ".lightbox-nav, .lightbox-pager, .lightbox-close, .lightbox-indicator",
      )
    ) {
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

  const resolveGestureAxis = (
    deltaX: number,
    deltaY: number,
  ): "none" | "x" | "y" => {
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

    if (eventTargetsVideoControlChrome(event)) {
      return
    }

    pointerStartX = event.clientX
    pointerStartY = event.clientY
    gestureAxis = "none"
    setDragOffsetX(0)
    setDragOffsetY(0)
    setIsDragging(true)

    if (
      event.currentTarget instanceof HTMLElement &&
      "setPointerCapture" in event.currentTarget
    ) {
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
      class={cx("lightbox", {
        "is-desktop": isDesktop(),
        "is-mobile": !isDesktop(),
      })}
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
        <div
          class={cx("lightbox-indicator", {
            "is-compact": total() > LIGHTBOX_DOT_PAGER_MAX,
          })}>
          <Show when={total() > LIGHTBOX_DOT_PAGER_MAX}>
            <IconButton
              class="lightbox-pager lightbox-pager-previous"
              size="sm"
              icon="chevron_left"
              aria-label={props.labels.previous}
              onClick={goPrevious}
            />
          </Show>
          <span class="lightbox-counter">
            {props.labels.counter(active() + 1, total())}
          </span>
          <Show when={total() > LIGHTBOX_DOT_PAGER_MAX}>
            <IconButton
              class="lightbox-pager lightbox-pager-next"
              size="sm"
              icon="chevron_right"
              aria-label={props.labels.next}
              onClick={goNext}
            />
          </Show>
          <Show when={total() <= LIGHTBOX_DOT_PAGER_MAX}>
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
          </Show>
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
    <Show when={isOpen()}>
      <Dialog
        open
        onOpenChange={open => {
          if (!open) {
            closeLightbox()
          }
        }}
        modal
        preventScroll
        overlayClass="lightbox-overlay"
        class="lightbox-dialog">
        <LightboxContent
          initialIndex={props.index!}
          media={props.media}
          labels={props.labels}
          swipeThreshold={props.swipeThreshold}
          onClose={closeLightbox}
        />
      </Dialog>
    </Show>
  )
}
