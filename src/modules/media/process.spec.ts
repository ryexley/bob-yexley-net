// @vitest-environment node
import { readFileSync } from "node:fs"
import sharp from "sharp"
import { describe, expect, it } from "vitest"
import {
  MEDIA_VARIANT_NAMES,
  MEDIA_VARIANT_WIDTHS,
  needsHeicDecode,
  processImage,
} from "./process"

const HEIC_FIXTURE = new URL("./__fixtures__/sample-hevc.heic", import.meta.url)
// A real iPhone export (HDR gain map + depth) whose `iref` box has more
// references than sharp's bundled libheif allows — reproduces the production
// crash that forced raw HEIC away from sharp entirely.
const IPHONE_GAINMAP_FIXTURE = new URL(
  "./__fixtures__/iphone-gainmap.heic",
  import.meta.url,
)

/** Build a solid-color JPEG of the given dimensions for use as a source image. */
async function makeJpeg(width: number, height: number): Promise<Uint8Array> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 160, b: 200 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe("processImage", () => {
  it("generates micro/small/medium/large WebP variants at the target widths", async () => {
    const source = await makeJpeg(3000, 2000)

    const result = await processImage(source)

    expect(result.original).toEqual({ width: 3000, height: 2000, format: "jpeg" })
    expect(result.variants.map(v => v.variant)).toEqual(MEDIA_VARIANT_NAMES)

    for (const variant of result.variants) {
      const expectedWidth = MEDIA_VARIANT_WIDTHS[variant.variant]
      expect(variant.contentType).toBe("image/webp")
      expect(variant.width).toBe(expectedWidth)
      // 3:2 source aspect ratio is preserved.
      expect(variant.height).toBe(Math.round(expectedWidth * (2000 / 3000)))

      // The bytes are real, decodable WebP matching the reported dimensions.
      const meta = await sharp(variant.data).metadata()
      expect(meta.format).toBe("webp")
      expect(meta.width).toBe(variant.width)
      expect(meta.height).toBe(variant.height)
    }
  })

  it("never upscales a source smaller than a variant target", async () => {
    const source = await makeJpeg(150, 100)

    const result = await processImage(source)

    expect(result.original.width).toBe(150)
    for (const variant of result.variants) {
      expect(variant.width).toBeLessThanOrEqual(150)
      expect(variant.height).toBeLessThanOrEqual(100)
    }
  })

  it("rejects bytes that are not a decodable image", async () => {
    await expect(processImage(Buffer.from("definitely not an image"))).rejects.toThrow()
  })

  it("decodes an HEVC-based HEIC into WebP variants (sharp can't decode it alone)", async () => {
    const heic = readFileSync(HEIC_FIXTURE)

    // Guard the test's own premise: sharp's prebuilt binary must be unable to
    // decode this file directly, so the heic-convert path is what's exercised.
    await expect(
      sharp(heic).resize({ width: 64 }).webp().toBuffer(),
    ).rejects.toThrow()

    const result = await processImage(heic)

    expect(result.original.format).toBe("heif")
    expect(result.original.width).toBe(1440)
    expect(result.original.height).toBe(960)
    expect(result.variants.map(v => v.variant)).toEqual(MEDIA_VARIANT_NAMES)

    const small = result.variants.find(v => v.variant === "small")!
    expect(small.width).toBe(200)
    const smallMeta = await sharp(small.data).metadata()
    expect(smallMeta.format).toBe("webp")
    expect(smallMeta.width).toBe(200)

    // 1440px source: "large" (2048 target) is capped to the source width.
    const large = result.variants.find(v => v.variant === "large")!
    expect(large.width).toBe(1440)
  })

  // Regression: modern iPhone HEICs (HDR gain map / depth) carry an `iref` box
  // with more references than sharp's bundled libheif permits, so even a header
  // read via `sharp(buffer).metadata()` throws a security-limit error. The fix
  // routes raw HEIC through heic-convert BEFORE sharp ever sees it. Guard against
  // anyone reintroducing a sharp() call on the original bytes.
  it("processes a real iPhone HEIC that sharp's libheif rejects outright", async () => {
    const heic = readFileSync(IPHONE_GAINMAP_FIXTURE)

    // Premise: sharp can't even read this file's header directly.
    await expect(sharp(heic).metadata()).rejects.toThrow(/iref|security limit/i)

    // But the full pipeline succeeds via the heic-convert fallback.
    const result = await processImage(heic)

    expect(result.original.format).toBe("heif")
    expect(result.original.width).toBeGreaterThan(0)
    expect(result.original.height).toBeGreaterThan(0)
    expect(result.variants.map(v => v.variant)).toEqual(MEDIA_VARIANT_NAMES)
    for (const variant of result.variants) {
      const meta = await sharp(variant.data).metadata()
      expect(meta.format).toBe("webp")
      expect(meta.width).toBe(variant.width)
    }
  })
})

describe("needsHeicDecode", () => {
  it("flags the HEVC HEIC fixture", () => {
    expect(needsHeicDecode(readFileSync(HEIC_FIXTURE))).toBe(true)
  })

  it("does not flag a JPEG", async () => {
    const jpeg = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer()
    expect(needsHeicDecode(jpeg)).toBe(false)
  })

  it("does not flag AVIF (sharp handles it directly)", async () => {
    const avif = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .avif()
      .toBuffer()
    expect(needsHeicDecode(avif)).toBe(false)
  })
})
