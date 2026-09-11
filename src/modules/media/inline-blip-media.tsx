import { Show, createSignal, type JSX } from "solid-js"
import { Icon } from "@/components/icon"
import { PersonalCloudImage } from "@/components/personal-cloud-image"
import { ptr } from "@/i18n"
import {
  parseMediaEmbedAlign,
  parseMediaEmbedLightbox,
  parseMediaEmbedSize,
  type MediaEmbedProps,
} from "@/components/markdown/media/media-embed-syntax"
import type { BlipMediaRow } from "./data/queries"
import { MediaVariant, originalUrl, variantUrl } from "./media-utils"

function mediaRowFromEmbed(embed: MediaEmbedProps): BlipMediaRow {
  return {
    id: `inline:${embed.key}`,
    blip_id: "",
    user_id: "",
    media_type: embed.type,
    mime_type: embed.mime ?? "",
    storage_key: embed.key,
    processing_status: "complete",
    file_size: 0,
    width: null,
    height: null,
    duration_s: null,
    display_order: 0,
    created_at: "",
    placement: "inline",
  } as BlipMediaRow
}

export type InlineBlipMediaProps = {
  embed: MediaEmbedProps
  record?: BlipMediaRow
  onOpen?: (record: BlipMediaRow) => void
}

/**
 * Reader-side inline media. On the detail page `onOpen` opens the existing
 * lightbox when the embed opts in (`lightbox: true`). GIFs stay in-place with
 * play/pause. Video posters still open the lightbox when `onOpen` is provided.
 */
export function InlineBlipMedia(props: InlineBlipMediaProps) {
  const mediaType = () => props.record?.media_type ?? props.embed.type
  const mimeType = () => props.record?.mime_type ?? props.embed.mime ?? ""
  const storageKey = () => props.record?.storage_key ?? props.embed.key
  const processingStatus = () =>
    (props.record?.processing_status as "pending" | "complete" | "failed") ??
    "complete"
  const lightboxEnabled = () => parseMediaEmbedLightbox(props.embed.lightbox)
  const openRecord = () => props.record ?? mediaRowFromEmbed(props.embed)
  const interactive = () => {
    if (typeof props.onOpen !== "function") {
      return false
    }
    if (mediaType() === "gif") {
      return false
    }
    if (mediaType() === "image") {
      return lightboxEnabled()
    }
    return true
  }

  const open = () => {
    if (!interactive()) {
      return
    }
    props.onOpen?.(openRecord())
  }

  return (
    <div
      class="media-embed"
      data-media-type={mediaType()}
      data-media-size={parseMediaEmbedSize(props.embed.size)}
      data-media-align={parseMediaEmbedAlign(props.embed.align)}
      data-media-lightbox={lightboxEnabled() ? "true" : undefined}
      data-interactive={interactive() ? "true" : undefined}>
      <Show when={mediaType() === "image"}>
        <InlineImage
          storageKey={storageKey()}
          mimeType={mimeType()}
          processingStatus={processingStatus()}
          interactive={interactive()}
          onOpen={open}
        />
      </Show>
      <Show when={mediaType() === "gif"}>
        <InlineGif
          storageKey={storageKey()}
          mimeType={mimeType() || "image/gif"}
        />
      </Show>
      <Show when={mediaType() === "video"}>
        <InlineVideo
          storageKey={storageKey()}
          mimeType={mimeType() || "video/mp4"}
          interactive={interactive()}
          onOpen={open}
        />
      </Show>
    </div>
  )
}

function MediaFrame(props: {
  interactive: boolean
  ariaLabel?: string
  onOpen: () => void
  children: JSX.Element
}) {
  return (
    <Show
      when={props.interactive}
      fallback={<div class="frame">{props.children}</div>}>
      <button
        type="button"
        class="frame"
        aria-label={props.ariaLabel}
        onClick={() => props.onOpen()}>
        {props.children}
      </button>
    </Show>
  )
}

function InlineImage(props: {
  storageKey: string
  mimeType: string
  processingStatus: "pending" | "complete" | "failed"
  interactive: boolean
  onOpen: () => void
}) {
  const tr = ptr("blips.components.blip.media")
  const image = () => (
    <PersonalCloudImage
      imageKey={props.storageKey}
      mimeType={props.mimeType}
      processingStatus={props.processingStatus}
      objectFit="contain"
      alt=""
      class={props.interactive ? undefined : "frame"}
      imageClass="media"
    />
  )
  return (
    <Show
      when={props.interactive}
      fallback={image()}>
      <button
        type="button"
        class="frame"
        aria-label={tr("openLightbox")}
        onClick={() => props.onOpen()}>
        {image()}
      </button>
    </Show>
  )
}

function InlineGif(props: { storageKey: string; mimeType: string }) {
  const tr = ptr("blips.components.blip.media")
  const [playing, setPlaying] = createSignal(true)
  let image: HTMLImageElement | undefined
  let freeze: HTMLCanvasElement | undefined

  const gifSrc = () => originalUrl(props.storageKey, props.mimeType)

  const freezeFrame = () => {
    const img = image
    const canvas = freeze
    if (img && canvas && img.naturalWidth > 0 && img.naturalHeight > 0) {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext("2d")?.drawImage(img, 0, 0)
    }
  }

  const toggle = (event: Event) => {
    event.stopPropagation()
    if (playing()) {
      freezeFrame()
      setPlaying(false)
      return
    }
    setPlaying(true)
  }

  return (
    <div
      class="frame"
      classList={{ "is-paused": !playing() }}>
      <img
        ref={el => {
          image = el
        }}
        class="media"
        src={playing() ? gifSrc() : undefined}
        alt=""
        loading="lazy"
        hidden={!playing()}
      />
      <canvas
        ref={el => {
          freeze = el
        }}
        class="media freeze"
        hidden={playing()}
        aria-hidden="true"
      />
      <button
        type="button"
        class="playback"
        aria-label={playing() ? tr("pauseGif") : tr("playGif")}
        aria-pressed={!playing()}
        onClick={toggle}
        onKeyDown={event => event.stopPropagation()}>
        <span
          class="play"
          aria-hidden="true">
          <Icon name={playing() ? "pause" : "play_arrow"} />
        </span>
      </button>
    </div>
  )
}

function InlineVideo(props: {
  storageKey: string
  mimeType: string
  interactive: boolean
  onOpen: () => void
}) {
  const tr = ptr("blips.components.blip.media")
  const [fallback, setFallback] = createSignal(false)
  const poster = () => (
    <Show
      when={!fallback()}
      fallback={
        <video
          class="media"
          src={originalUrl(props.storageKey, props.mimeType)}
          muted
          playsinline
          preload="metadata">
          <track kind="captions" />
        </video>
      }>
      <img
        class="media"
        src={variantUrl(props.storageKey, MediaVariant.Thumb)}
        alt=""
        loading="lazy"
        onError={() => setFallback(true)}
      />
    </Show>
  )

  return (
    <MediaFrame
      interactive={props.interactive}
      ariaLabel={tr("openVideo")}
      onOpen={props.onOpen}>
      {poster()}
      <span
        class="play"
        aria-hidden="true">
        <Icon name="play_arrow" />
      </span>
    </MediaFrame>
  )
}
