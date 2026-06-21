/**
 * Shared media URL / object-key helpers (spec §13.4).
 *
 * `blip_media.storage_key` is a *base* key with no extension
 * (e.g. `media/{user}/{blip}/{name}`). The original object and the generated
 * WebP variants are derived from it by convention:
 *
 *   {key}-original.{ext}            — preserved source (ext from mime type)
 *   {key}-{micro|small|medium|large}.webp — sharp-generated variants
 *
 * This module owns that derivation in one place so `mediaStore` (URL + R2
 * cleanup keys) and, later, `PersonalCloudImage` (variant URLs) agree.
 *
 * Client-safe: no R2/AWS/Supabase coupling. URL builders read the public base
 * from `VITE_MEDIA_STORAGE_URL`, matching `r2Service.getPublicUrl`.
 */

/**
 * Variant identifiers (spec §13.4). Modeled as a const object + union (the
 * repo's `BLIP_TYPES` convention) rather than a TS `enum`, so `MediaVariant.Small`
 * ergonomics are preserved while staying consistent with the codebase.
 */
export const MediaVariant = {
  Original: "original",
  Micro: "micro",
  Large: "large",
  Medium: "medium",
  Small: "small",
  Thumb: "thumb",
} as const

export type MediaVariant = (typeof MediaVariant)[keyof typeof MediaVariant]

/** Canonical mime -> extension for the stored original (spec §2 accepted types). */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

/**
 * Map a mime type to the extension used for the preserved original object.
 * Tolerates a trailing `; charset=...` and unknown types (falls back to `bin`).
 */
export function mimeTypeToExtension(mimeType: string): string {
  const mime = (mimeType ?? "").toLowerCase().split(";")[0].trim()
  return MIME_TO_EXT[mime] ?? "bin"
}

/** Strip a single trailing slash so key concatenation is clean. */
function storageBaseUrl(): string {
  const base = import.meta.env.VITE_MEDIA_STORAGE_URL || ""
  if (!base) {
    console.warn("VITE_MEDIA_STORAGE_URL is not configured")
  }
  return base.replace(/\/+$/, "")
}

/** R2 object key for the preserved original: `{key}-original.{ext}`. */
export function originalKey(key: string, mimeType: string): string {
  return `${key}-original.${mimeTypeToExtension(mimeType)}`
}

/** R2 object key for a generated WebP variant: `{key}-{variant}.webp`. */
export function variantKey(key: string, variant: MediaVariant): string {
  return `${key}-${variant}.webp`
}

/** Public URL for a generated WebP variant (spec §13.4). */
export function variantUrl(key: string, variant: MediaVariant): string {
  return `${storageBaseUrl()}/${variantKey(key, variant)}`
}

/** Public URL for the preserved original, with source extension (spec §13.4). */
export function originalUrl(key: string, mimeType: string): string {
  return `${storageBaseUrl()}/${originalKey(key, mimeType)}`
}

/**
 * Upper px bound (longest edge) for each non-`large` image variant (spec §13.3).
 * Anything larger than `medium` resolves to `large`.
 */
export const VARIANT_MAX_PX = {
  micro: 96,
  small: 300,
  medium: 1024,
} as const

/**
 * Pick the WebP variant to request for an image given the intended *render*
 * size (spec §13.3): `≤96px → micro`, `≤300px → small`, `≤1024px → medium`,
 * else `large`. Uses
 * the larger of `width`/`height`. When neither is a positive number the caller's
 * `fallback` is returned (`PersonalCloudImage` derives it from the device/screen
 * size); defaults to `medium`. Pure + client-safe so it stays unit-testable.
 */
export function pickVariant(
  options: {
    width?: number | null
    height?: number | null
    fallback?: MediaVariant
  } = {},
): MediaVariant {
  const { width, height, fallback = MediaVariant.Medium } = options
  const target = Math.max(
    typeof width === "number" && width > 0 ? width : 0,
    typeof height === "number" && height > 0 ? height : 0,
  )
  if (target === 0) {
    return fallback
  }
  if (target <= VARIANT_MAX_PX.micro) {
    return MediaVariant.Micro
  }
  if (target <= VARIANT_MAX_PX.small) {
    return MediaVariant.Small
  }
  if (target <= VARIANT_MAX_PX.medium) {
    return MediaVariant.Medium
  }
  return MediaVariant.Large
}

/**
 * Generated WebP variants tried in ascending size when the preferred variant is
 * missing (404). `Thumb` is client-extracted only — not part of this chain.
 */
export const VARIANT_FALLBACK_ORDER: MediaVariant[] = [
  MediaVariant.Micro,
  MediaVariant.Small,
  MediaVariant.Medium,
  MediaVariant.Large,
]

/** Subset of originals browsers can render in `<img>` without a WebP variant. */
const BROWSER_DISPLAYABLE_ORIGINAL_EXTS = new Set(["jpg", "png", "webp", "gif"])

export function variantFallbackChain(primary: MediaVariant): MediaVariant[] {
  const start = VARIANT_FALLBACK_ORDER.indexOf(primary)
  if (start === -1) {
    return [primary]
  }
  return VARIANT_FALLBACK_ORDER.slice(start)
}

/**
 * Ordered `<img>` candidate URLs for a storage key: preferred variant through
 * larger WebP siblings, then the original when the browser can display it.
 */
export function variantCandidateUrls(
  key: string,
  primary: MediaVariant,
  mimeType?: string | null,
): string[] {
  const urls = variantFallbackChain(primary).map(variant => variantUrl(key, variant))
  if (mimeType) {
    const ext = mimeTypeToExtension(mimeType)
    if (BROWSER_DISPLAYABLE_ORIGINAL_EXTS.has(ext)) {
      urls.push(originalUrl(key, mimeType))
    }
  }
  return [...new Set(urls)]
}
