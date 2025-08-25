import type { Component } from "solid-js"
import {
  createSignal,
  createEffect,
  createMemo,
  splitProps,
  onMount,
  onCleanup,
} from "solid-js"
import { ImagePlaceholder } from "@/components/icon"
import { tr } from "@/i18n"
import { cx } from "@/util"
import {
  getDimensions,
  resolveContainerDimension,
  generateRandomRadialGradients,
} from "@/util/image"
import {
  fetchUnsplashPhoto,
  trackUnsplashDownload,
  getUnsplashAttribution,
  getUnsplashAttributionUrl,
  getCachedUnsplashImage,
  cacheUnsplashImage,
} from "@/lib/vendor/unsplash"

interface ImageProps {
  imageId: string // Full unsplash photo slug, like: green-forest-5bMj6krNKiM
  height?: number | string
  width?: number | string
  alt?: string
  class?: string
  imageClass?: string
  eager?: boolean
  brightness?: number
  blur?: number
  quality?: number
  showAttribution?: boolean
  trackDownload?: boolean
  objectFit?: "cover" | "contain" | "fill" | "scale-down" | "none"
  [key: string]: any
}

export const UnsplashImage: Component<ImageProps> = props => {
  const [local, rest] = splitProps(props, [
    "imageId",
    "height",
    "width",
    "alt",
    "class",
    "imageClass",
    "eager",
    "brightness",
    "blur",
    "quality",
    "showAttribution",
    "trackDownload",
    "objectFit",
  ])

  let image: HTMLImageElement | undefined
  let imageContainer: HTMLDivElement | undefined
  let intersectionObserver: IntersectionObserver | undefined

  const [imageLoaded, setImageLoaded] = createSignal(false)
  const [imageStatus, setImageStatus] = createSignal(
    tr("shared.components.image.imageStatusPending"),
  )
  const [photoData, setPhotoData] = createSignal(null)
  const [isInView, setIsInView] = createSignal(false)

  const placeholderBackground = createMemo(() =>
    generateRandomRadialGradients(),
  )

  // Helper functions to access props with defaults - matching Image component
  const getImageId = () => local.imageId
  const getHeight = () => local.height
  const getWidth = () => local.width
  const getAlt = () => {
    const userAlt = local.alt?.trim()
    if (userAlt) return userAlt

    const photo = photoData()
    if (photo?.alt_description) return photo.alt_description
    if (photo?.description) return photo.description

    return String(local.imageId ?? "")
  }
  const getClass = () => local.class
  const getEager = () => local.eager ?? false
  const getShowAttribution = () => local.showAttribution ?? true
  const getTrackDownload = () => local.trackDownload ?? true
  const getObjectFit = () => local.objectFit ?? "cover"
  const isErrorStatus = () => imageStatus().includes("failed to load")

  const dimensions = createMemo(() =>
    getDimensions({ width: getWidth(), height: getHeight() }),
  )

  const resolvedDimensions = createMemo(() => ({
    height: resolveContainerDimension(dimensions().height),
    width: resolveContainerDimension(dimensions().width),
  }))

  const containerStyle = createMemo(() => ({
    height: resolvedDimensions().height,
    width: resolvedDimensions().width,
  }))

  const placeholderStyle = createMemo(() => ({
    background: placeholderBackground(),
    opacity: imageLoaded() ? 0 : 1,
  }))

  const imageStyle = createMemo(() => ({
    filter: cx(
      local.brightness !== undefined && `brightness(${local.brightness})`,
      local.blur !== undefined && `blur(${local.blur}rem)`,
    ),
  }))

  const imageUrl = createMemo(() => {
    // Don't generate URL until component is in view
    if (!isInView()) return ""

    const photo = photoData()

    // If we have photo data from the API, use the official URLs
    if (photo?.urls) {
      // Use the same dimension logic as the Image component
      const width =
        typeof dimensions().width === "number" ? dimensions().width : undefined

      // Choose the best Unsplash size based on container dimensions
      let selectedUrl = photo.urls.regular // Default: ~1080px wide

      if (width && typeof width === "number") {
        if (width > 1920) {
          selectedUrl = photo.urls.full // ~2048px wide or original size
        } else if (width > 1080) {
          selectedUrl = photo.urls.full // Use full for high-res displays
        } else if (width <= 400) {
          selectedUrl = photo.urls.small // ~400px wide
        }
      }

      return selectedUrl
    }

    // Don't provide fallback URL until we've tried the API
    // This prevents invalid URLs from causing immediate errors
    return ""
  })

  const attribution = createMemo(() => {
    const photo = photoData()
    return photo ? getUnsplashAttribution(photo) : null
  })

  const attributionUrl = createMemo(() => {
    const photo = photoData()
    const webUrl = tr("site.url")
    const utmSource = Array.isArray(webUrl) ? webUrl.join("") : webUrl
    return photo ? getUnsplashAttributionUrl(photo, utmSource) : null
  })

  // Setup intersection observer on mount
  onMount(() => {
    if (getEager()) {
      // If eager loading is requested, skip intersection observer
      setIsInView(true)
      loadPhotoData()
      return
    }

    if (!imageContainer || typeof IntersectionObserver === "undefined") {
      // Fallback for environments without IntersectionObserver
      setIsInView(true)
      loadPhotoData()
      return
    }

    intersectionObserver = new IntersectionObserver(
      entries => {
        const [entry] = entries
        if (entry.isIntersecting) {
          setIsInView(true)
          loadPhotoData()
          // Disconnect observer after first intersection
          intersectionObserver?.disconnect()
        }
      },
      {
        rootMargin: "50px", // Start loading 50px before coming into view
        threshold: 0.1, // Trigger when 10% of the element is visible
      },
    )

    intersectionObserver.observe(imageContainer)
  })

  // Cleanup intersection observer
  onCleanup(() => {
    intersectionObserver?.disconnect()
  })

  // Load photo data from Unsplash API or cache
  const loadPhotoData = async () => {
    const imageId = getImageId()

    // Validate imageId before making API call
    if (
      !imageId ||
      typeof imageId !== "string" ||
      imageId.trim().length === 0
    ) {
      setImageStatus(
        tr("shared.components.image.imageStatusError", { alt: getAlt() }),
      )
      return
    }

    // Exit early for problematic imageIds
    if (imageId === "background" || imageId.length < 5) {
      setImageStatus(
        tr("shared.components.image.imageStatusError", { alt: getAlt() }),
      )
      return
    }

    // Update status to loading when we start the API call
    setImageStatus(tr("shared.components.image.imageStatusLoading"))

    try {
      // First check cache
      const cachedPhoto = getCachedUnsplashImage(imageId)
      if (cachedPhoto) {
        setPhotoData(cachedPhoto)
        return
      }

      // Fall back to API call
      const photo = await fetchUnsplashPhoto(imageId)
      if (photo) {
        setPhotoData(photo)

        // Cache this image for future use (non-blocking)
        setTimeout(() => {
          cacheUnsplashImage(imageId).catch(() => {
            // Silently fail - caching is not critical
          })
        }, 100)
      } else {
        // No photo data received, set error status
        setImageStatus(
          tr("shared.components.image.imageStatusError", { alt: getAlt() }),
        )
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      // API call failed, set error status
      setImageStatus(
        tr("shared.components.image.imageStatusError", { alt: getAlt() }),
      )
    }
  }

  const handleImageLoaded = () => {
    const photo = photoData()

    // Track download if enabled and photo data is available
    if (getTrackDownload() && photo) {
      trackUnsplashDownload(photo).catch(() => {})
    }

    setImageStatus(
      tr("shared.components.image.imageStatusLoaded", {
        alt: getAlt(),
        cr:
          attribution() ||
          `© ${new Date().getFullYear()} ${tr("org.shortName")}`,
      }),
    )
    setImageLoaded(true)
  }

  const handleImageError = () => {
    setImageStatus(
      tr("shared.components.image.imageStatusError", { alt: getAlt() }),
    )
    setImageLoaded(false)
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
        "cdn-image-container relative min-h-[10rem] min-w-[10rem] h-full w-full overflow-hidden",
        getClass(),
      )}
      style={containerStyle() as any}>
      <div
        class={cx(
          "cdn-image-placeholder absolute inset-0 flex min-h-[10rem] min-w-[10rem] h-full w-full flex-col items-center justify-center overflow-hidden p-4 transition-opacity duration-500 ease-in-out border border-[var(--colors-mono-02)]",
        )}
        style={placeholderStyle()}
        aria-hidden={imageLoaded()}>
        <ImagePlaceholder class="relative h-1/2 w-1/2 max-h-40 overflow-hidden opacity-[0.025]" />
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
      </div>

      {/* Only render img element when in view and we have a valid URL */}
      {isInView() && imageUrl() && (
        <img
          ref={el => (image = el)}
          src={imageUrl()}
          alt={getAlt()}
          loading={getEager() ? "eager" : "lazy"}
          class={cx(
            "absolute inset-0 block min-h-[10rem] min-w-[10rem] h-full w-full opacity-0 transition-opacity duration-500 ease-in-out will-change-transform",
            { "opacity-100": imageLoaded() },
            local.imageClass,
          )}
          style={{
            ...imageStyle(),
            "object-fit": getObjectFit(),
            "object-position": "center",
          }}
          onLoad={handleImageLoaded}
          onError={handleImageError}
          {...rest}
        />
      )}

      {/* Attribution overlay */}
      {getShowAttribution() && photoData() && (
        <div class="absolute bottom-0 right-0 bg-black/50 px-3 py-2 m-2 rounded-sm leading-tight text-[0.65rem] text-[var(--colors-mono-10)]">
          {tr("shared.components.unsplashImage.attribution", {
            photographer: () => (
              <a
                href={attributionUrl()}
                target="_blank"
                rel="noopener noreferrer"
                class="hover:underline underline-offset-2">
                {photoData()?.user.name}
              </a>
            ),
          })}
        </div>
      )}
    </div>
  )
}
