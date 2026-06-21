import { For, Show, createMemo, createSignal } from "solid-js"
import { Icon } from "@/components/icon"
import { PersonalCloudImage } from "@/components/personal-cloud-image"
import { clsx as cx } from "@/util"
import { generateRandomRadialGradients } from "@/util/image"
import type { BlipMediaRow } from "./data/queries"
import { MediaVariant, originalUrl, variantUrl } from "./media-utils"

/** Max real thumbnails before the overflow tile takes the 4th slot (spec §6). */
const MAX_VISIBLE = 3

/**
 * GIF card tile (spec §2.3 / §6): a *static* first frame. Tries the generated
 * `-thumb.webp`; pre-thumb media (no static frame exists) falls back to the
 * animated original so old GIFs keep rendering.
 */
function StripGifThumb(props: { record: BlipMediaRow }) {
  const [fallback, setFallback] = createSignal(false)
  const src = () =>
    fallback()
      ? originalUrl(props.record.storage_key, props.record.mime_type)
      : variantUrl(props.record.storage_key, MediaVariant.Thumb)
  return (
    <img
      class="gif"
      src={src()}
      alt=""
      loading="lazy"
      onError={() => setFallback(true)}
    />
  )
}

/**
 * Video card tile (spec §6, loose-end 2): a lightweight static poster `<img>`
 * (no `<video>` element on the feed) plus a play-icon overlay. Pre-thumb media
 * falls back to the previous muted `<video preload="metadata">` first frame.
 */
function StripVideoThumb(props: { record: BlipMediaRow }) {
  const [fallback, setFallback] = createSignal(false)
  return (
    <span class="video">
      <Show
        when={!fallback()}
        fallback={
          <video
            src={originalUrl(props.record.storage_key, props.record.mime_type)}
            muted
            playsinline
            preload="metadata">
            <track kind="captions" />
          </video>
        }>
        <img
          class="poster"
          src={variantUrl(props.record.storage_key, MediaVariant.Thumb)}
          alt=""
          loading="lazy"
          onError={() => setFallback(true)}
        />
      </Show>
      <span
        class="play"
        aria-hidden="true">
        <Icon name="play_arrow" />
      </span>
    </span>
  )
}

export type BlipCardMediaStripLabels = {
  /** Optional aria-label for the strip region, e.g. `(3) => "3 attachments"`. */
  region?: (count: number) => string
  /** Overflow tile text, e.g. `(2) => "+2"` (count is `total - 3`). */
  overflow: (count: number) => string
}

export type BlipCardMediaStripProps = {
  media: BlipMediaRow[]
  labels: BlipCardMediaStripLabels
  class?: string
}

/**
 * The feed-card media preview (spec §6) — the deliberate opposite of
 * {@link import("./blip-media-gallery").BlipMediaGallery}: a small,
 * **non-interactive** strip capped at three ~2rem thumbnails plus a `+n`
 * overflow tile. It renders nothing interactive; tapping the surrounding card
 * navigates to the blip detail page (where the lightbox lives), so the strip
 * must not introduce its own buttons/tab stops.
 *
 * Reuses the Phase 6 read primitives: images via `PersonalCloudImage`
 * (`small` WebP), GIFs as a *static* first frame (`-thumb.webp`, spec §2.3 / §6),
 * and videos as a static poster `<img>` (`-thumb.webp`) with a play-icon overlay.
 * Both video/GIF tiles fall back to their pre-thumb rendering (animated GIF /
 * muted `<video>` first frame) when a generated thumb is absent.
 */
export function BlipCardMediaStrip(props: BlipCardMediaStripProps) {
  const visible = () => props.media.slice(0, MAX_VISIBLE)
  const overflowCount = () => Math.max(0, props.media.length - MAX_VISIBLE)
  const overflowBackground = createMemo(() =>
    generateRandomRadialGradients({
      sizeMin: 0.375,
      sizeMax: 0.875,
      count: 5,
      opacity: 0.55,
    }),
  )

  return (
    <Show when={props.media.length > 0}>
      <div
        class={cx("blip-card-media-strip", props.class)}
        data-count={props.media.length}
        aria-label={props.labels.region?.(props.media.length)}>
        <For each={visible()}>
          {record => (
            <span
              class="item"
              data-type={record.media_type}>
              <Show when={record.media_type === "image"}>
                <PersonalCloudImage
                  imageKey={record.storage_key}
                  mimeType={record.mime_type}
                  processingStatus={
                    record.processing_status as "pending" | "complete" | "failed"
                  }
                  variant={MediaVariant.Small}
                  objectFit="cover"
                  alt=""
                />
              </Show>
              <Show when={record.media_type === "gif"}>
                <StripGifThumb record={record} />
              </Show>
              <Show when={record.media_type === "video"}>
                <StripVideoThumb record={record} />
              </Show>
            </span>
          )}
        </For>
        <Show when={overflowCount() > 0}>
          <span
            class="overflow"
            aria-hidden="true"
            style={{ "background-image": overflowBackground() }}>
            {props.labels.overflow(overflowCount())}
          </span>
        </Show>
      </div>
    </Show>
  )
}
