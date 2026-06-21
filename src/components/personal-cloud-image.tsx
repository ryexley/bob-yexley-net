import type { Component } from "solid-js"
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js"
import { ImagePlaceholder } from "@/components/icon"
import { tr } from "@/i18n"
import { cx } from "@/util"
import {
  generateRandomRadialGradients,
  getDimensions,
  parseDimension,
  resolveContainerDimension,
} from "@/util/image"
import {
  MediaVariant,
  pickVariant,
  variantCandidateUrls,
} from "@/modules/media/media-utils"

export type ProcessingStatus = "pending" | "complete" | "failed"

/**
 * `PersonalCloudImage` renders an image from the blip media (R2) backend
 * (spec §13). It is the reader-side counterpart to `CloudinaryImage`: it reuses
 * that component's placeholder + lazy-load + fade-in *behavior* but swaps the
 * Cloudinary transform machinery for the `storage_key` + `MediaVariant`
 * convention.
 *
 * Notable departures from `CloudinaryImage` (intentional — spec §5/§13):
 * - No `@unpic`/responsive-srcset/transform `operations`. R2 variants are
 *   discrete pre-generated files with no on-the-fly transform endpoint, so a
 *   single discrete `<img>` per picked variant is correct; responsive breakpoints
 *   would have nothing to resize against.
 * - Variant selection is a discrete `small/medium/large` pick from the *render*
 *   size (`pickVariant`), not `@unpic` breakpoints.
 * - Graceful 404 fallback walks ordered WebP variants then the original (when the
 *   browser can display it), mirroring `ComposerPreviewModal`'s `onError` pattern.
 * - `processing_status === 'pending'` renders the placeholder only and never
 *   attempts a load (variants don't exist yet; spec §13.5).
 *
 * Images only — GIFs (animated original) and video posters use other renderers.
 */
interface PersonalCloudImageProps {
  /** Base `blip_media.storage_key` (no extension); variants derived by convention. */
  imageKey: string
  /** Source mime type — enables the `original` fallback URL. */
  mimeType?: string
  /** Defaults to `complete`; `pending` shows the placeholder with no load. */
  processingStatus?: ProcessingStatus
  /** Force a specific variant, bypassing dimension-based selection. */
  variant?: MediaVariant
  height?: number | string
  width?: number | string
  alt?: string
  class?: string
  imageClass?: string
  eager?: boolean
  /** When false, skip the 500ms opacity fade-in after load (e.g. lightbox). Default true. */
  fadeIn?: boolean
  objectFit?: "cover" | "contain" | "fill" | "scale-down" | "none"
  [key: string]: any
}

export const PersonalCloudImage: Component<PersonalCloudImageProps> = props => {
  const [local, rest] = splitProps(props, [
    "imageKey",
    "mimeType",
    "processingStatus",
    "variant",
    "height",
    "width",
    "alt",
    "class",
    "imageClass",
    "eager",
    "fadeIn",
    "objectFit",
  ])

  let image: HTMLImageElement | undefined
  let imageContainer: HTMLDivElement | undefined
  let intersectionObserver: IntersectionObserver | undefined

  const [imageLoaded, setImageLoaded] = createSignal(false)
  const [imageStatus, setImageStatus] = createSignal(
    tr("shared.components.image.imageStatusPending"),
  )
  const [isInView, setIsInView] = createSignal(local.eager ?? false)
  const [candidateIndex, setCandidateIndex] = createSignal(0)

  const placeholderBackground = createMemo(() =>
    generateRandomRadialGradients(),
  )

  const getEager = () => local.eager ?? false
  const getFadeIn = () => local.fadeIn ?? true
  const getObjectFit = () => local.objectFit ?? "cover"
  const getProcessingStatus = (): ProcessingStatus =>
    local.processingStatus ?? "complete"
  const getAlt = () => {
    const alt = local.alt
    if (typeof alt === "string" && alt.trim().length > 0) {
      return alt
    }
    return ""
  }
  const isErrorStatus = () => imageStatus().includes("failed to load")

  // Device/screen fallback when no render dimensions are supplied: desktop gets
  // the `large` variant, narrower viewports `medium`. SSR (no `matchMedia`)
  // defaults to `medium` — the safe middle ground (spec §13.3).
  const [deviceVariant, setDeviceVariant] = createSignal<MediaVariant>(
    MediaVariant.Medium,
  )

  const pxWidth = createMemo(() => {
    const parsed = parseDimension(local.width)
    return typeof parsed === "number" ? parsed : undefined
  })
  const pxHeight = createMemo(() => {
    const parsed = parseDimension(local.height)
    return typeof parsed === "number" ? parsed : undefined
  })

  /** Teaser tiles (gallery strip, etc.) hide verbose status captions. */
  const COMPACT_PLACEHOLDER_MAX_PX = 120

  const isCompactPlaceholder = createMemo(() => {
    const target = Math.max(pxWidth() ?? 0, pxHeight() ?? 0)
    return target > 0 && target <= COMPACT_PLACEHOLDER_MAX_PX
  })

  const variant = createMemo<MediaVariant>(() =>
    local.variant ??
    pickVariant({
      width: pxWidth(),
      height: pxHeight(),
      fallback: deviceVariant(),
    }),
  )

  const candidates = createMemo<string[]>(() => {
    if (getProcessingStatus() === "pending") {
      return []
    }
    const key = local.imageKey
    if (!key) {
      return []
    }
    return variantCandidateUrls(key, variant(), local.mimeType)
  })

  const currentSrc = createMemo(() => {
    if (!isInView()) {
      return undefined
    }
    const list = candidates()
    const index = candidateIndex()
    return index < list.length ? list[index] : undefined
  })

  const dimensions = createMemo(() =>
    getDimensions({ width: local.width, height: local.height }),
  )
  const containerStyle = createMemo(() => ({
    height: resolveContainerDimension(dimensions().height),
    width: resolveContainerDimension(dimensions().width),
    "aspect-ratio": String(dimensions().aspectRatio),
  }))
  const placeholderStyle = createMemo(() => ({
    background: placeholderBackground(),
    opacity: imageLoaded() || (!getFadeIn() && currentSrc()) ? 0 : 1,
  }))

  createEffect(() => {
    if (getEager()) {
      setIsInView(true)
      setImageStatus(tr("shared.components.image.imageStatusLoading"))
    }
  })

  // Reset the load/fallback state whenever the source set changes (new key,
  // variant, or processing transition) so a recycled component re-attempts
  // from the largest candidate.
  createEffect(() => {
    local.imageKey
    variant()
    getProcessingStatus()
    setCandidateIndex(0)
    setImageLoaded(false)
  })

  onMount(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      setDeviceVariant(
        window.matchMedia("(min-width: 768px)").matches
          ? MediaVariant.Large
          : MediaVariant.Medium,
      )
    }

    if (getEager()) {
      setIsInView(true)
      setImageStatus(tr("shared.components.image.imageStatusLoading"))
      return
    }

    if (!imageContainer || typeof IntersectionObserver === "undefined") {
      setIsInView(true)
      setImageStatus(tr("shared.components.image.imageStatusLoading"))
      return
    }

    intersectionObserver = new IntersectionObserver(
      entries => {
        const [entry] = entries
        if (entry.isIntersecting) {
          setIsInView(true)
          setImageStatus(tr("shared.components.image.imageStatusLoading"))
          intersectionObserver?.disconnect()
        }
      },
      {
        rootMargin: "50px",
        threshold: 0.1,
      },
    )

    intersectionObserver.observe(imageContainer)
  })

  onCleanup(() => {
    intersectionObserver?.disconnect()
  })

  const handleImageLoaded = () => {
    setImageStatus(
      tr("shared.components.image.imageStatusLoaded", {
        alt: getAlt(),
        cr: `© ${new Date().getFullYear()} ${tr("site.title")}`,
      }),
    )
    setImageLoaded(true)
  }

  const handleImageError = () => {
    // Advance to the next ordered candidate (variant → original). When the list
    // is exhausted `currentSrc` becomes undefined and the placeholder shows.
    setImageLoaded(false)
    setCandidateIndex(index => {
      const next = index + 1
      if (next >= candidates().length) {
        setImageStatus(
          tr("shared.components.image.imageStatusError", { alt: getAlt() }),
        )
      }
      return next
    })
  }

  createEffect(() => {
    if (image && image.complete && image.naturalWidth > 0) {
      handleImageLoaded()
    }
  })

  return (
    <div
      ref={imageContainer}
      class={cx(
        "personal-cloud-image relative min-h-[6rem] min-w-[6rem] h-full w-full overflow-hidden",
        local.class,
      )}
      data-variant={variant()}
      style={containerStyle()}>
      <div
        class={cx(
          "personal-cloud-image-placeholder absolute inset-0 flex h-full w-full flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ease-in-out border border-[var(--colors-mono-02)]",
          isCompactPlaceholder() ? "p-1" : "p-4",
        )}
        style={placeholderStyle()}
        aria-hidden={imageLoaded()}>
        <Show
          when={isCompactPlaceholder() && isErrorStatus()}
          fallback={
            <>
              <Show when={!isCompactPlaceholder()}>
                <ImagePlaceholder
                  class="relative h-1/2 w-1/2 max-h-40 overflow-hidden opacity-[0.025]"
                />
              </Show>
              <Show when={!isCompactPlaceholder()}>
                <div
                  class={cx(
                    "text-center text-xs uppercase text-balance",
                    isErrorStatus()
                      ? "!text-[var(--colors-cerise-pink)]/50"
                      : "text-white/12",
                  )}
                  aria-hidden={imageLoaded()}>
                  {imageStatus()}
                </div>
              </Show>
            </>
          }>
          <ImagePlaceholder
            class="h-7 w-7 shrink-0 text-[var(--colors-cerise-pink)]/45"
            role="img"
            aria-label={imageStatus()}
          />
        </Show>
      </div>

      {currentSrc() && (
        <img
          ref={el => {
            image = el
          }}
          class={cx(
            "personal-cloud-image-img absolute inset-0 block h-full w-full",
            getFadeIn() && "opacity-0 transition-opacity duration-500 ease-in-out",
            { "opacity-100": imageLoaded() || !getFadeIn() },
            local.imageClass,
          )}
          src={currentSrc()}
          alt={getAlt()}
          loading={getEager() ? "eager" : "lazy"}
          style={{
            "object-fit": getObjectFit(),
            "object-position": "center",
          }}
          onLoad={handleImageLoaded}
          onError={handleImageError}
          {...rest}
        />
      )}
    </div>
  )
}
