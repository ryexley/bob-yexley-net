import type { Component } from "solid-js"
import {
  createSignal,
  createEffect,
  createMemo,
  splitProps,
  onMount,
  onCleanup,
} from "solid-js"
import { Image as UnpicImage } from "@unpic/solid"
import { Monogram as Logo } from "@/components/logos"
import { tr } from "@/i18n"
import { cx } from "@/util"
import {
  getDimensions,
  resolveContainerDimension,
  generateRandomRadialGradients,
  imageUrl,
} from "@/util/image"

/**
 * CloudinaryImageProps for the Solid.js CloudinaryImage component.
 *
 * This component wraps @unpic/solid's UnpicImage specifically for Cloudinary images
 * and supports the following prop combinations:
 *
 * For layout="constrained" (default):
 *   - You can provide either `width` or `height` (numbers or strings with units)
 *   - If only one dimension is provided, the other will be calculated using the default aspect ratio
 *   - If both are provided, they will be used as specified
 *
 * The component will default to layout="constrained" and will respect the provided dimensions
 * while maintaining aspect ratio when only one dimension is specified.
 *
 * The `alt` prop is required for accessibility. If not provided, the `imageId` will be used as a fallback.
 */
interface CloudinaryImageProps {
  imageId: string
  height?: number | string
  width?: number | string
  alt?: string
  class?: string
  imageClass?: string
  eager?: boolean
  /* e.g. 0.25 */
  brightness?: number
  /* e.g. 0.325 */
  blur?: number
  quality?: number
  objectFit?: "cover" | "contain" | "fill" | "scale-down" | "none"
  [key: string]: any
}

// Move static configurations outside component to prevent recreation
const IMAGE_BREAKPOINTS = [320, 480, 640, 768, 1024, 1280, 1536, 1920]
const IMAGE_OPERATIONS = {
  cloudinary: {
    f: "auto",
    q: "auto" as const,
    dpr: 2,
  },
}

export const CloudinaryImage: Component<CloudinaryImageProps> = props => {
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
    "objectFit",
  ])

  let image: HTMLImageElement | undefined
  let imageContainer: HTMLDivElement | undefined
  let intersectionObserver: IntersectionObserver | undefined

  const [imageLoaded, setImageLoaded] = createSignal(false)
  const [imageStatus, setImageStatus] = createSignal(
    tr("shared.components.image.imageStatusPending"),
  )
  const [isInView, setIsInView] = createSignal(false)

  const placeholderBackground = createMemo(() =>
    generateRandomRadialGradients(),
  )

  // Helper functions to access props with defaults
  const getImageId = () => local.imageId
  const getHeight = () => local.height
  const getWidth = () => local.width
  const getAlt = () => {
    const alt = local.alt
    if (typeof alt === "string" && alt.trim().length > 0) return alt
    if (Array.isArray(alt) && alt.length > 0) return alt.join(" ")
    return String(local.imageId ?? "")
  }
  const getClass = () => local.class
  const getEager = () => local.eager ?? false
  const getQuality = () => local.quality ?? 80
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

  // Memoized image URL with fallback handling
  const resolvedImageUrl = createMemo(() => {
    if (!isInView()) return ""

    const url = imageUrl(getImageId())
    if (!url) {
      setImageStatus(
        tr("shared.components.image.imageStatusError", { alt: getAlt() }),
      )
      return ""
    }
    return url
  })

  // Memoized image props to prevent recreation on every render
  const imageProps = createMemo(() => {
    const url = resolvedImageUrl()
    if (!url) return null

    const height =
      typeof dimensions().height === "number" ? dimensions().height : undefined
    const width =
      typeof dimensions().width === "number" ? dimensions().width : undefined

    // Apply quality to operations if specified
    const operations = {
      ...IMAGE_OPERATIONS,
      cloudinary: {
        ...IMAGE_OPERATIONS.cloudinary,
        ...(getQuality() !== 80 && { q: getQuality() }),
      },
    }

    return {
      ref: (el: HTMLImageElement) => {
        image = el
      },
      src: url,
      alt: getAlt(),
      height,
      width,
      aspectRatio: dimensions().aspectRatio,
      layout: "constrained" as const,
      class: cx(
        "absolute inset-0 block min-h-[10rem] min-w-[10rem] h-full w-full opacity-0 transition-opacity duration-500 ease-in-out will-change-transform",
        { "opacity-100": imageLoaded() },
        local.imageClass,
      ),
      style: {
        ...imageStyle(),
        objectFit: getObjectFit(),
        objectPosition: "center",
      },
      breakpoints: IMAGE_BREAKPOINTS,
      priority: getEager(),
      loading: (getEager() ? "eager" : "lazy") as "eager" | "lazy",
      onLoad: handleImageLoaded,
      onError: handleImageError,
      operations,
      ...rest,
    }
  })

  // Setup intersection observer on mount
  onMount(() => {
    if (getEager()) {
      // If eager loading is requested, skip intersection observer
      setIsInView(true)
      setImageStatus(tr("shared.components.image.imageStatusLoading"))
      return
    }

    if (!imageContainer || typeof IntersectionObserver === "undefined") {
      // Fallback for environments without IntersectionObserver
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
      style={containerStyle()}>
      <div
        class={cx(
          "cdn-image-placeholder absolute inset-0 flex min-h-[10rem] min-w-[10rem] h-full w-full flex-col items-center justify-center overflow-hidden p-4 transition-opacity duration-500 ease-in-out border border-[var(--colors-mono-02)]",
        )}
        style={placeholderStyle()}
        aria-hidden={imageLoaded()}>
        <Logo class="relative h-1/2 w-1/2 max-h-40 overflow-hidden opacity-[0.025]" />
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

      {/* Only render image when in view and we have valid props */}
      {isInView() && imageProps() && <UnpicImage {...(imageProps() as any)} />}
    </div>
  )
}
