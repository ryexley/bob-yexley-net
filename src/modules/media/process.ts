/**
 * Pure image-processing core for the media feature.
 *
 * Trust boundary / runtime:
 * - Server-only. Depends on `sharp`, whose native libvips binary requires the
 *   Node.js runtime (never edge). Must not be re-exported from the client barrel.
 * - This module is intentionally free of auth, R2, and Supabase concerns so it
 *   can be unit-tested and exercised by standalone Node scripts without mocks.
 *
 * HEIC note: sharp's prebuilt binaries decode the HEIF container and AVIF, but
 * NOT the patent-encumbered HEVC codec that real iPhone HEICs use (verified to
 * fail on Vercel's linux-x64 runtime). For HEVC-HEIF inputs we first decode to a
 * JPEG buffer with `heic-convert` (libde265 compiled to WASM) and hand that to
 * sharp. See plans/blips-media-feature-handoff.md.
 */
import heicConvert from "heic-convert"
import sharp from "sharp"

/**
 * Target widths (px) for each generated WebP variant.
 * Heights are derived to preserve the source aspect ratio.
 */
export const MEDIA_VARIANT_WIDTHS = {
  micro: 96,
  small: 200,
  medium: 1024,
  large: 2048,
} as const

export type MediaVariantName = keyof typeof MEDIA_VARIANT_WIDTHS

export const MEDIA_VARIANT_NAMES = Object.keys(
  MEDIA_VARIANT_WIDTHS,
) as MediaVariantName[]

/** WebP quality used for every generated variant. */
const WEBP_QUALITY = 80

/** Quality of the intermediate JPEG produced when decoding HEVC-HEIF via heic-convert. */
const HEIC_JPEG_QUALITY = 0.92

/**
 * Upper bound on source pixels. Guards the HEVC-HEIF (WASM) decode path against
 * OOM on pathological inputs; 100MP comfortably covers any real camera while a
 * full RGBA bitmap stays within a serverless function's memory.
 */
export const MAX_SOURCE_PIXELS = 100_000_000

// ISO-BMFF `ftyp` brands that indicate an HEVC-based HEIF (decoded via heic-convert).
// AVIF (`avif`/`avis`) is handled by sharp directly and intentionally excluded.
const HEVC_HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "heif",
])

const ASCII_DECODER = new TextDecoder("latin1")
const fourCC = (bytes: Uint8Array, start: number): string =>
  ASCII_DECODER.decode(bytes.subarray(start, start + 4))

/** Read the major + compatible brands from an ISO-BMFF `ftyp` box. */
function readFtypBrands(bytes: Uint8Array): string[] {
  if (bytes.length < 12 || fourCC(bytes, 4) !== "ftyp") {
    return []
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const declaredSize = view.getUint32(0)
  const end = Math.min(declaredSize > 0 ? declaredSize : bytes.length, bytes.length)
  const brands = [fourCC(bytes, 8)]
  // Bytes 12–16 are the minor version; compatible brands follow in 4-byte chunks.
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(fourCC(bytes, offset))
  }
  return brands
}

/**
 * True when bytes are an HEVC-based HEIF that sharp's prebuilt binary cannot
 * decode and must be routed through heic-convert first.
 */
export function needsHeicDecode(bytes: Uint8Array): boolean {
  const brands = readFtypBrands(bytes)
  if (brands.length === 0) {
    return false
  }
  if (brands.some(brand => brand === "avif" || brand === "avis")) {
    return false
  }
  return brands.some(brand => HEVC_HEIF_BRANDS.has(brand))
}

export type ProcessedVariant = {
  variant: MediaVariantName
  data: Uint8Array
  width: number
  height: number
  contentType: "image/webp"
}

export type ProcessImageResult = {
  /** Dimensions/format of the source image, in display orientation. */
  original: { width: number; height: number; format: string }
  variants: ProcessedVariant[]
}

/**
 * Decode an image and produce the micro/small/medium/large WebP variants.
 *
 * - EXIF orientation is honored (`.rotate()`), so variant dimensions reflect how
 *   the image is actually displayed.
 * - `withoutEnlargement` means a variant is never upscaled past the source; a
 *   small original simply yields variants at (or below) its native size. All
 *   four variants are always emitted so downstream key derivation stays uniform.
 *
 * @param input Raw bytes of the original image (JPEG/PNG/WebP/HEIC/...).
 * @throws if the bytes cannot be decoded as an image.
 */
export async function processImage(
  input: Uint8Array,
): Promise<ProcessImageResult> {
  const source = input

  // sharp can't decode HEVC-HEIF, and its bundled libheif also rejects the header
  // of modern iPhone HEICs (e.g. "iref box references exceed security limits" for
  // files carrying HDR gain maps / depth). So raw HEIC must NEVER touch sharp:
  // decode it with heic-convert (more permissive WASM libheif) first, then let
  // sharp work only on the resulting JPEG.
  const isHeic = needsHeicDecode(source)
  const decodable: Uint8Array = isHeic
    ? await heicConvert({
        buffer: source,
        format: "JPEG",
        quality: HEIC_JPEG_QUALITY,
      })
    : source

  // Metadata of the buffer sharp will actually process. For non-HEIC this is a
  // cheap header parse on the original; for HEIC it's the intermediate JPEG.
  // `failOn: "none"` keeps decoding resilient to the minor corruption common in
  // real-world phone uploads instead of throwing on the first warning.
  const meta = await sharp(decodable, { failOn: "none" }).metadata()
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("Unsupported or unreadable image: missing dimensions/format")
  }
  if (meta.width * meta.height > MAX_SOURCE_PIXELS) {
    throw new Error(
      `Image exceeds the ${MAX_SOURCE_PIXELS}px processing limit ` +
        `(${meta.width}x${meta.height})`,
    )
  }

  // Orientation values 5–8 swap the visual width/height relative to stored pixels.
  const swapsAxes = (meta.orientation ?? 1) >= 5
  const originalWidth = swapsAxes ? meta.height : meta.width
  const originalHeight = swapsAxes ? meta.width : meta.height

  const variants: ProcessedVariant[] = []
  for (const variant of MEDIA_VARIANT_NAMES) {
    // A sharp instance is single-use after `toBuffer`, so start fresh per variant.
    const { data, info } = await sharp(decodable, { failOn: "none" })
      .rotate()
      .resize({ width: MEDIA_VARIANT_WIDTHS[variant], withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })

    variants.push({
      variant,
      data,
      width: info.width,
      height: info.height,
      contentType: "image/webp",
    })
  }

  return {
    original: {
      width: originalWidth,
      height: originalHeight,
      // Report the true source format ("heif" for HEIC), not the intermediate JPEG.
      format: isHeic ? "heif" : meta.format,
    },
    variants,
  }
}
