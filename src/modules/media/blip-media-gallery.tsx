import { For, Show, createSignal } from "solid-js"
import { Icon } from "@/components/icon"
import { PersonalCloudImage } from "@/components/personal-cloud-image"
import { clsx as cx } from "@/util"
import type { BlipMediaRow } from "./data/queries"
import { Lightbox, type LightboxLabels } from "./lightbox"
import { MediaVariant, originalUrl, variantUrl } from "./media-utils"

/** Display size for multi-item gallery thumbnails on the blip detail page. */
export const GALLERY_THUMB_PX = 80

/**
 * Video gallery tile: static `-thumb.webp` poster `<img>` (matches the feed-card
 * strip). A `<video src>` on the tile blows up grid intrinsic sizing and posters
 * are unreliable; pre-thumb media falls back to muted `preload="metadata"`.
 */
function GalleryVideoThumb(props: { record: BlipMediaRow }) {
  const [fallback, setFallback] = createSignal(false)
  return (
    <span class="blip-media-gallery-video">
      <Show
        when={!fallback()}
        fallback={
          <video
            class="blip-media-gallery-video-el"
            src={originalUrl(props.record.storage_key, props.record.mime_type)}
            muted
            playsinline
            preload="metadata">
            <track kind="captions" />
          </video>
        }>
        <img
          class="blip-media-gallery-video-poster"
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

export type BlipMediaGalleryLabels = LightboxLabels & {
  /** aria-label for a thumbnail trigger, e.g. `(2, 8) => "View media 2 of 8"`. */
  openItem: (index: number, total: number) => string
}

export type BlipMediaGalleryProps = {
  media: BlipMediaRow[]
  labels: BlipMediaGalleryLabels
  class?: string
  /**
   * When set, thumbnail taps delegate to the parent and no gallery-local
   * {@link Lightbox} is rendered (used for a single page-wide carousel).
   */
  onOpenItem?: (record: BlipMediaRow) => void
  /** aria-label for a thumbnail when {@link onOpenItem} is set. */
  getOpenItemLabel?: (record: BlipMediaRow) => string
}

/**
 * The detail-page media surface (spec §7.7 MVP): a compact grid of tappable
 * teaser thumbnails that opens the {@link Lightbox} at the tapped index. Used
 * on root blips and update blips — always the same small teaser size; the
 * lightbox is where media is viewed full-size.
 *
 * Images use a small WebP variant via `PersonalCloudImage`; GIFs render the
 * original; videos show a static `-thumb.webp` poster with a play-icon overlay.
 */
export function BlipMediaGallery(props: BlipMediaGalleryProps) {
  const [openIndex, setOpenIndex] = createSignal<number | null>(null)
  const usesPageLightbox = () => typeof props.onOpenItem === "function"

  const openItem = (record: BlipMediaRow, localIndex: number) => {
    if (usesPageLightbox()) {
      props.onOpenItem!(record)
      return
    }
    setOpenIndex(localIndex)
  }

  const itemAriaLabel = (record: BlipMediaRow, localIndex: number) => {
    if (props.getOpenItemLabel) {
      return props.getOpenItemLabel(record)
    }
    return props.labels.openItem(localIndex + 1, props.media.length)
  }

  return (
    <Show when={props.media.length > 0}>
      <div
        class={cx("blip-media-gallery", props.class)}
        data-count={props.media.length}>
        <For each={props.media}>
          {(record, index) => (
            <button
              type="button"
              class="blip-media-gallery-item"
              aria-label={itemAriaLabel(record, index())}
              onClick={() => openItem(record, index())}>
              <Show when={record.media_type === "image"}>
                <PersonalCloudImage
                  imageKey={record.storage_key}
                  mimeType={record.mime_type}
                  processingStatus={
                    record.processing_status as "pending" | "complete" | "failed"
                  }
                  variant={MediaVariant.Micro}
                  width={GALLERY_THUMB_PX}
                  height={GALLERY_THUMB_PX}
                  objectFit="cover"
                  eager
                  class="blip-media-gallery-image"
                />
              </Show>
              <Show when={record.media_type === "gif"}>
                <img
                  class="blip-media-gallery-gif"
                  src={originalUrl(record.storage_key, record.mime_type)}
                  alt=""
                  loading="lazy"
                />
              </Show>
              <Show when={record.media_type === "video"}>
                <GalleryVideoThumb record={record} />
              </Show>
            </button>
          )}
        </For>
      </div>

      <Show when={!usesPageLightbox()}>
        <Lightbox
          media={props.media}
          index={openIndex()}
          onClose={() => setOpenIndex(null)}
          labels={props.labels}
        />
      </Show>
    </Show>
  )
}
