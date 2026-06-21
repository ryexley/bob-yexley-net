import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Icon, ImagePlaceholder } from "@/components/icon"
import { clsx as cx } from "@/util"
import type { Attachment } from "./media-store"

export type MediaThumbnailProps = {
  attachment: Attachment
  onRemove: (key: string) => void
  onRetry: (key: string) => void
  onPreview: (attachment: Attachment) => void
  removeLabel: string
  retryLabel: string
  previewLabel: string
}

const PROGRESS_RADIUS = 14
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS

/** Keeps the same `<img>` node; only swaps `src` when the URL string changes. */
function ThumbnailPreviewImage(props: { src: string; onError: () => void }) {
  let image: HTMLImageElement | undefined
  let currentSrc: string | undefined

  const applySrc = (url: string) => {
    if (!image || !url || currentSrc === url) {
      return
    }
    currentSrc = url
    image.src = url
  }

  createEffect(() => {
    applySrc(props.src)
  })

  return (
    <img
      ref={el => {
        image = el
        applySrc(props.src)
      }}
      class="media-thumbnail-image"
      alt=""
      onError={() => props.onError()}
    />
  )
}

/**
 * Composer strip video/GIF tile: static poster `<img>` (`posterUrl`), falling back
 * to `<video preload="metadata">` with `mediaSrc` when the poster cannot decode.
 */
function ComposerVideoThumb(props: { posterUrl?: string; mediaSrc?: string }) {
  const [posterFailed, setPosterFailed] = createSignal(false)
  return (
    <Show
      when={!posterFailed() && props.posterUrl}
      fallback={
        <Show when={props.mediaSrc}>
          <video
            class="media-thumbnail-image"
            src={props.mediaSrc}
            muted
            playsinline
            preload="metadata"
          />
        </Show>
      }>
      <img
        class="media-thumbnail-image"
        src={props.posterUrl!}
        alt=""
        onError={() => setPosterFailed(true)}
      />
    </Show>
  )
}

/**
 * One composer attachment (spec §11.3): image/video/GIF preview with a circular
 * upload-progress overlay, processing spinner, error + retry state, and a remove
 * `×` with a ≥44×44 hit area. Tapping the body (outside the remove/retry
 * controls) opens the preview modal.
 */
export function MediaThumbnail(props: MediaThumbnailProps) {
  const [previewFailed, setPreviewFailed] = createSignal(false)

  const status = () => props.attachment.status
  const isMotionMedia = () =>
    props.attachment.mediaType === "video" ||
    props.attachment.mediaType === "gif"
  const isUploading = () =>
    status() === "pending" || status() === "uploading"
  const isProcessing = () => status() === "processing"
  const isError = () => status() === "error"
  const progress = () => props.attachment.progress ?? 0

  const previewUrl = () => props.attachment.previewUrl
  const posterUrl = () =>
    props.attachment.posterUrl ?? props.attachment.previewUrl
  const mediaSrc = () => props.attachment.mediaSrc

  const showPlaceholder = createMemo(() => {
    if (isError()) {
      return true
    }
    if (isMotionMedia()) {
      return !posterUrl() && !mediaSrc()
    }
    return !previewUrl() || previewFailed()
  })

  const progressOffset = createMemo(
    () => PROGRESS_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, progress())) / 100),
  )

  const handleBodyClick = () => {
    if (isError()) {
      return
    }
    props.onPreview(props.attachment)
  }

  return (
    <div
      class={cx("media-thumbnail", {
        "is-error": isError(),
        "is-busy": isUploading() || isProcessing(),
        "is-motion-media": isMotionMedia(),
      })}>
      <button
        type="button"
        class="media-thumbnail-body"
        aria-label={props.previewLabel}
        onClick={handleBodyClick}>
        <Show
          when={!showPlaceholder()}
          fallback={
            <span class="media-thumbnail-placeholder">
              <ImagePlaceholder class="media-thumbnail-placeholder-icon" />
            </span>
          }>
          <Show
            when={isMotionMedia()}
            fallback={
              <ThumbnailPreviewImage
                src={previewUrl()!}
                onError={() => setPreviewFailed(true)}
              />
            }>
            <ComposerVideoThumb
              posterUrl={posterUrl()}
              mediaSrc={mediaSrc()}
            />
          </Show>
        </Show>

        <Show when={props.attachment.mediaType === "video" && !showPlaceholder()}>
          <span class="media-thumbnail-type-badge">
            <Icon name="play_arrow" />
          </span>
        </Show>

        <Show when={isUploading()}>
          <span class="media-thumbnail-overlay">
            <svg
              class="media-thumbnail-progress"
              viewBox="0 0 32 32"
              aria-hidden="true">
              <circle
                class="media-thumbnail-progress-track"
                cx="16"
                cy="16"
                r={PROGRESS_RADIUS}
              />
              <circle
                class="media-thumbnail-progress-value"
                cx="16"
                cy="16"
                r={PROGRESS_RADIUS}
                stroke-dasharray={PROGRESS_CIRCUMFERENCE}
                stroke-dashoffset={progressOffset()}
              />
            </svg>
          </span>
        </Show>

        <Show when={isProcessing()}>
          <span class="media-thumbnail-overlay">
            <svg
              class="media-thumbnail-progress media-thumbnail-progress--indeterminate"
              viewBox="0 0 32 32"
              aria-hidden="true">
              <circle
                class="media-thumbnail-progress-value"
                cx="16"
                cy="16"
                r={PROGRESS_RADIUS}
                stroke-dasharray={PROGRESS_CIRCUMFERENCE}
                stroke-dashoffset={PROGRESS_CIRCUMFERENCE * 0.7}
              />
            </svg>
          </span>
        </Show>

        <Show when={isError()}>
          <span
            class="media-thumbnail-overlay media-thumbnail-overlay--error"
            role="button"
            tabindex="0"
            aria-label={props.retryLabel}
            onClick={event => {
              event.stopPropagation()
              props.onRetry(props.attachment.key)
            }}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                event.stopPropagation()
                props.onRetry(props.attachment.key)
              }
            }}>
            <Icon name="refresh" />
          </span>
        </Show>
      </button>

      <button
        type="button"
        class="media-thumbnail-remove"
        aria-label={props.removeLabel}
        onClick={event => {
          event.stopPropagation()
          props.onRemove(props.attachment.key)
        }}>
        <Icon name="close" />
      </button>
    </div>
  )
}
