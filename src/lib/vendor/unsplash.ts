import { getEnv } from "@/util/env"

interface UnsplashPhoto {
  id: string
  slug: string
  created_at: string
  updated_at: string
  width: number
  height: number
  color: string
  description: string | null
  alt_description: string | null
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
    small_s3: string
  }
  links: {
    self: string
    html: string
    download: string
    download_location: string
  }
  user: {
    id: string
    username: string
    name: string
    portfolio_url: string | null
    bio: string | null
    location: string | null
    links: {
      self: string
      html: string
      photos: string
      likes: string
      portfolio: string
      following: string
      followers: string
    }
    profile_image: {
      small: string
      medium: string
      large: string
    }
    instagram_username: string | null
    total_collections: number
    total_likes: number
    total_photos: number
  }
}

const UNSPLASH_API_BASE = "https://api.unsplash.com"

/**
 * Clear expired image cache if needed
 */
async function clearExpiredImageCache(): Promise<void> {
  try {
    const cacheCheckKey = "unsplash-image-cache-timestamp"
    const imageCacheExpiry = 30 * 24 * 60 * 60 * 1000 // 30 days

    const lastCacheTime = localStorage.getItem(cacheCheckKey)
    if (
      lastCacheTime &&
      Date.now() - parseInt(lastCacheTime) > imageCacheExpiry
    ) {
      await caches.delete("unsplash-images-v1")
      localStorage.removeItem(cacheCheckKey)
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Silently fail
  }
}

/**
 * Extract Unsplash photo ID from a slug or URL
 * Handles cases like:
 * - "WdE8-Uqgbcs" -> "WdE8-Uqgbcs" (direct ID)
 * - "green-forest-5bMj6krNKiM" -> "5bMj6krNKiM" (descriptive slug + ID)
 * - "maple-trees-WdE8-Uqgbcs" -> "WdE8-Uqgbcs" (descriptive slug + ID with dash)
 */
function extractPhotoId(photoIdOrSlug: string): string {
  const originalSlug = photoIdOrSlug.trim()

  if (!originalSlug.includes("-")) {
    return originalSlug
  }

  const segments = originalSlug.split("-")

  // First, try last 2-3 segments for IDs with dashes (higher priority)
  // This catches patterns like "unDA-Z0zOjM" before individual segments

  // Try last 2 segments (handles IDs with dashes like "WdE8-Uqgbcs" or "unDA-Z0zOjM")
  if (segments.length >= 2) {
    const lastTwo = segments.slice(-2).join("-")
    if (
      lastTwo.length >= 10 &&
      lastTwo.length <= 12 &&
      /^[A-Za-z0-9-]+$/.test(lastTwo) &&
      // Must contain at least one number or uppercase letter (Unsplash ID characteristic)
      /[0-9A-Z]/.test(lastTwo)
    ) {
      return lastTwo
    }
  }

  // Try last 3 segments (edge case for complex IDs)
  if (segments.length >= 3) {
    const lastThree = segments.slice(-3).join("-")
    if (
      lastThree.length >= 10 &&
      lastThree.length <= 15 &&
      /^[A-Za-z0-9-]+$/.test(lastThree) &&
      // Must contain at least one number or uppercase letter
      /[0-9A-Z]/.test(lastThree)
    ) {
      return lastThree
    }
  }

  // Look for typical single-segment ID patterns (10-11 chars, alphanumeric)
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]
    if (
      segment.length >= 10 &&
      segment.length <= 11 &&
      /^[A-Za-z0-9]+$/.test(segment) &&
      // Must contain at least one number or uppercase letter (avoid words like "background")
      /[0-9A-Z]/.test(segment)
    ) {
      return segment
    }
  }

  return segments[segments.length - 1]
}

/**
 * Fetch photo details from Unsplash API
 */
export async function fetchUnsplashPhoto(
  photoIdOrSlug: string,
): Promise<UnsplashPhoto | null> {
  const env = getEnv()
  if (!env.UNSPLASH_ACCESS_KEY) {
    return null
  }

  // Validate input before processing
  if (
    !photoIdOrSlug ||
    typeof photoIdOrSlug !== "string" ||
    photoIdOrSlug.trim().length === 0
  ) {
    return null
  }

  try {
    const photoId = extractPhotoId(photoIdOrSlug)

    // Additional validation after extraction
    if (!photoId || photoId.length < 5) {
      return null
    }

    const response = await fetch(`${UNSPLASH_API_BASE}/photos/${photoId}`, {
      headers: {
        Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const photo: UnsplashPhoto = await response.json()
    return photo
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return null
  }
}

/**
 * Trigger a download tracking call to Unsplash (required by their API terms)
 */
export async function trackUnsplashDownload(
  photo: UnsplashPhoto,
): Promise<void> {
  const env = getEnv()
  if (!env.UNSPLASH_ACCESS_KEY) {
    return
  }

  try {
    await fetch(photo.links.download_location, {
      headers: {
        Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
      },
    })
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Silently fail - download tracking is not critical
  }
}

/**
 * Get photo attribution text
 */
export function getUnsplashAttribution(photo: UnsplashPhoto): string {
  return `Photo by ${photo.user.name} on Unsplash`
}

/**
 * Get photo attribution URL
 */
export function getUnsplashAttributionUrl(
  photo: UnsplashPhoto,
  utmSource?: string,
): string {
  const source = utmSource || "harvestarchery.com"
  return `${photo.links.html}?utm_source=${source}&utm_medium=referral`
}

/**
 * Pre-fetch and cache Unsplash images in background
 */
export async function preloadUnsplashImages(imageIds: string[]): Promise<void> {
  // Skip if not in browser or localStorage not available
  if (typeof window === "undefined" || !window.localStorage) {
    return
  }

  const cacheKey = "unsplash-images-cache"
  const imageCacheName = "unsplash-images-v1"
  const cacheCheckKey = "unsplash-image-cache-timestamp"
  const cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours for metadata

  try {
    // Clear expired image cache first
    await clearExpiredImageCache()

    // Check if we already have fresh metadata cache
    const cached = localStorage.getItem(cacheKey)
    let existingImages = []
    let hasValidMetadataCache = false

    if (cached) {
      const { images, timestamp } = JSON.parse(cached)
      hasValidMetadataCache = Date.now() - timestamp < cacheExpiry
      if (hasValidMetadataCache) {
        existingImages = images
      }
    }

    // Check if we have image cache (simple check)
    const lastImageCacheTime = localStorage.getItem(cacheCheckKey)
    const hasRecentImageCache =
      lastImageCacheTime &&
      Date.now() - parseInt(lastImageCacheTime) < 30 * 24 * 60 * 60 * 1000

    // Filter out images we already have cached
    const existingImageIds = existingImages.map(img => img.id)
    const newImageIds = imageIds.filter(id => {
      const photoId = extractPhotoId(id)
      return !existingImageIds.includes(photoId)
    })

    if (
      newImageIds.length === 0 &&
      hasValidMetadataCache &&
      hasRecentImageCache
    ) {
      return // All images already cached
    }

    // Fetch new images metadata (with some delay between requests to be nice to API)
    const newImageData = []

    for (let i = 0; i < newImageIds.length; i++) {
      try {
        const photo = await fetchUnsplashPhoto(newImageIds[i])
        if (photo) {
          newImageData.push(photo)
        }

        // Small delay between requests to avoid hitting rate limits
        if (i < newImageIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        // Continue with other images
      }
    }

    // Merge with existing cached images
    const allImageData = [...existingImages, ...newImageData]

    // Cache the combined metadata
    const cacheData = {
      images: allImageData,
      timestamp: Date.now(),
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))

    // Pre-load new image files into browser cache
    if (newImageData.length > 0) {
      try {
        const imageCache = await caches.open(imageCacheName)
        const newImageUrls = newImageData.map(photo => photo.urls.regular)

        // Pre-load new images into Cache API for 30-day caching
        await imageCache.addAll(newImageUrls)

        // Update cache timestamp
        localStorage.setItem(cacheCheckKey, Date.now().toString())
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        // Silently fail
      }
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Silently fail
  }
}

/**
 * Get cached Unsplash image data if available
 */
export function getCachedUnsplashImage(imageId: string): UnsplashPhoto | null {
  // Skip if not in browser or localStorage not available
  if (typeof window === "undefined" || !window.localStorage) {
    return null
  }

  const cacheKey = "unsplash-images-cache"
  const cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours

  try {
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const { images, timestamp } = JSON.parse(cached)

    // Check if cache is expired
    if (Date.now() - timestamp > cacheExpiry) {
      localStorage.removeItem(cacheKey)
      return null
    }

    // Find the specific image
    const photoId = extractPhotoId(imageId)
    return images.find((img: UnsplashPhoto) => img.id === photoId) || null
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return null
  }
}

/**
 * Cache a single Unsplash image (for individual image requests)
 */
export async function cacheUnsplashImage(imageId: string): Promise<void> {
  try {
    const photo = await fetchUnsplashPhoto(imageId)
    if (!photo) return

    // Add to metadata cache
    const cacheKey = "unsplash-images-cache"
    const cached = localStorage.getItem(cacheKey)
    let images = []

    if (cached) {
      const { images: existingImages } = JSON.parse(cached)
      images = existingImages || []
    }

    // Check if already cached
    const photoId = extractPhotoId(imageId)
    const existingIndex = images.findIndex(img => img.id === photoId)

    if (existingIndex >= 0) {
      // Update existing
      images[existingIndex] = photo
    } else {
      // Add new
      images.push(photo)
    }

    // Save metadata
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        images,
        timestamp: Date.now(),
      }),
    )

    // Cache the image file
    const imageCache = await caches.open("unsplash-images-v1")
    await imageCache.add(photo.urls.regular)
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Silently fail
  }
}
