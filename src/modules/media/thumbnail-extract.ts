/**
 * Client-side first-frame extraction for video + GIF (handoff loose-ends 2 & 3).
 *
 * Produces a static WebP thumbnail from a *local* `File` at upload time, stored
 * to R2 under the `${storage_key}-thumb.webp` convention (`MediaVariant.Thumb`)
 * and consumed as a `<video poster>` (lightbox / gallery) and a static `<img>`
 * (feed card).
 *
 * Why client-side, pre-upload:
 * - `sharp` cannot decode video (and there is no ffmpeg here), so a video poster
 *   has no viable server path. Doing GIFs the same way keeps one code path and
 *   one key convention (spec §2.2 already chose client-side for video; §2.3 left
 *   GIF static-frame open).
 * - The source here is a same-origin `blob:` object URL, so drawing it to a
 *   canvas does NOT taint it. (The previously-rejected approach drew an
 *   already-uploaded *cross-origin* R2 object, which taints the canvas — that
 *   constraint does not apply before upload.)
 *
 * Runtime: browser only. Anywhere without `document`/canvas (SSR, tests by
 * default) every entry point resolves to `null` and the caller falls back to the
 * pre-thumb render behavior, so old media simply keeps working.
 */
import type { MediaType } from "./filename"

export type ExtractedThumbnail = {
  /** WebP-encoded first frame. */
  blob: Blob
  /** Intrinsic media width in px (`videoWidth` / `naturalWidth`). */
  width: number
  /** Intrinsic media height in px (`videoHeight` / `naturalHeight`). */
  height: number
  /** Whole-second video duration (videos only). */
  durationS?: number
}

const THUMB_MIME = "image/webp"
const THUMB_QUALITY = 0.8
/** Seek a hair past 0 — some decoders hold a black frame at exactly t=0. */
const VIDEO_SEEK_SECONDS = 0.1
/** Cap a wedged decode (corrupt / unsupported codec) so it can't hang an upload. */
const EXTRACT_TIMEOUT_MS = 10_000

function canExtract(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  )
}

/** Draw a decoded image/video frame to an offscreen canvas and encode it as WebP. */
function drawToWebp(
  source: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number,
): Promise<Blob | null> {
  if (!(width > 0) || !(height > 0)) {
    return Promise.resolve(null)
  }
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context || typeof canvas.toBlob !== "function") {
    return Promise.resolve(null)
  }
  context.drawImage(source, 0, 0, width, height)
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), THUMB_MIME, THUMB_QUALITY)
  })
}

function extractVideoThumbnail(file: File): Promise<ExtractedThumbnail | null> {
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")

  return new Promise<ExtractedThumbnail | null>(resolve => {
    let settled = false
    const finish = (result: ExtractedThumbnail | null): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      video.removeAttribute("src")
      try {
        video.load()
      } catch {
        // Ignore — only releasing the decoder.
      }
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), EXTRACT_TIMEOUT_MS)

    const grab = async (): Promise<void> => {
      const width = video.videoWidth
      const height = video.videoHeight
      const blob = await drawToWebp(video, width, height)
      finish(
        blob
          ? {
              blob,
              width,
              height,
              durationS: Number.isFinite(video.duration)
                ? Math.round(video.duration)
                : undefined,
            }
          : null,
      )
    }

    video.muted = true
    video.playsInline = true
    video.preload = "auto"

    video.addEventListener("error", () => finish(null))
    video.addEventListener("loadeddata", () => {
      const seekTo =
        Number.isFinite(video.duration) && video.duration > VIDEO_SEEK_SECONDS
          ? VIDEO_SEEK_SECONDS
          : 0
      try {
        video.currentTime = seekTo
      } catch {
        // Seeking unsupported — grab whatever frame is already decoded.
        void grab()
      }
    })
    video.addEventListener("seeked", () => {
      void grab()
    })

    video.src = url
    try {
      video.load()
    } catch {
      // Ignore — `loadeddata`/`error` still drive the flow.
    }
  })
}

function extractGifThumbnail(file: File): Promise<ExtractedThumbnail | null> {
  const url = URL.createObjectURL(file)
  const image = new Image()

  return new Promise<ExtractedThumbnail | null>(resolve => {
    let settled = false
    const finish = (result: ExtractedThumbnail | null): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), EXTRACT_TIMEOUT_MS)

    image.addEventListener("error", () => finish(null))
    image.addEventListener("load", () => {
      void (async () => {
        // A freshly-loaded GIF <img> sits on its first frame, so drawing it now
        // captures a static first frame.
        const width = image.naturalWidth
        const height = image.naturalHeight
        const blob = await drawToWebp(image, width, height)
        finish(blob ? { blob, width, height } : null)
      })()
    })

    image.src = url
  })
}

/**
 * Extract a static WebP first-frame thumbnail for a video or GIF, or `null` when
 * extraction is unavailable/unsupported/fails. Images return `null` (their
 * variants are generated server-side via `/api/media/process`).
 */
export async function extractThumbnail(
  file: File,
  mediaType: MediaType,
): Promise<ExtractedThumbnail | null> {
  if (!canExtract()) {
    return null
  }
  try {
    if (mediaType === "video") {
      return await extractVideoThumbnail(file)
    }
    if (mediaType === "gif") {
      return await extractGifThumbnail(file)
    }
    return null
  } catch (error) {
    console.error("Thumbnail extraction failed:", error)
    return null
  }
}
