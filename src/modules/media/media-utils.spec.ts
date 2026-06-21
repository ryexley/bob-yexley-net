import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MediaVariant,
  mimeTypeToExtension,
  originalKey,
  originalUrl,
  pickVariant,
  variantCandidateUrls,
  variantFallbackChain,
  variantKey,
  variantUrl,
} from "./media-utils"

describe("mimeTypeToExtension", () => {
  it("maps the accepted media mime types", () => {
    expect(mimeTypeToExtension("image/jpeg")).toBe("jpg")
    expect(mimeTypeToExtension("image/png")).toBe("png")
    expect(mimeTypeToExtension("image/webp")).toBe("webp")
    expect(mimeTypeToExtension("image/gif")).toBe("gif")
    expect(mimeTypeToExtension("image/heic")).toBe("heic")
    expect(mimeTypeToExtension("image/heif")).toBe("heic")
    expect(mimeTypeToExtension("video/mp4")).toBe("mp4")
    expect(mimeTypeToExtension("video/quicktime")).toBe("mov")
    expect(mimeTypeToExtension("video/webm")).toBe("webm")
  })

  it("tolerates casing and charset params, falls back to bin", () => {
    expect(mimeTypeToExtension("IMAGE/JPEG")).toBe("jpg")
    expect(mimeTypeToExtension("image/png; charset=binary")).toBe("png")
    expect(mimeTypeToExtension("application/octet-stream")).toBe("bin")
    expect(mimeTypeToExtension("")).toBe("bin")
  })
})

describe("object key derivation", () => {
  const base = "media/user1/blip1/20240815143022"

  it("derives the original key with the source extension", () => {
    expect(originalKey(base, "image/jpeg")).toBe(`${base}-original.jpg`)
    expect(originalKey(base, "video/quicktime")).toBe(`${base}-original.mov`)
  })

  it("derives webp variant keys", () => {
    expect(variantKey(base, MediaVariant.Micro)).toBe(`${base}-micro.webp`)
    expect(variantKey(base, MediaVariant.Small)).toBe(`${base}-small.webp`)
    expect(variantKey(base, MediaVariant.Medium)).toBe(`${base}-medium.webp`)
    expect(variantKey(base, MediaVariant.Large)).toBe(`${base}-large.webp`)
  })
})

describe("public URL derivation", () => {
  const base = "media/user1/blip1/20240815143022"

  beforeEach(() => {
    vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test/")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("strips a trailing slash from the base and builds variant URLs", () => {
    expect(variantUrl(base, MediaVariant.Small)).toBe(
      `https://cdn.test/${base}-small.webp`,
    )
  })

  it("builds original URLs with the source extension", () => {
    expect(originalUrl(base, "image/png")).toBe(
      `https://cdn.test/${base}-original.png`,
    )
  })
})

describe("pickVariant", () => {
  it("maps the larger render edge to a discrete variant (spec §13.3)", () => {
    expect(pickVariant({ width: 48, height: 48 })).toBe(MediaVariant.Micro)
    expect(pickVariant({ width: 64, height: 64 })).toBe(MediaVariant.Micro)
    expect(pickVariant({ width: 96 })).toBe(MediaVariant.Micro)
    expect(pickVariant({ width: 97 })).toBe(MediaVariant.Small)
    expect(pickVariant({ width: 300 })).toBe(MediaVariant.Small)
    expect(pickVariant({ width: 301 })).toBe(MediaVariant.Medium)
    expect(pickVariant({ width: 1024 })).toBe(MediaVariant.Medium)
    expect(pickVariant({ width: 2048 })).toBe(MediaVariant.Large)
    // Uses the longer edge — a tall portrait still resolves by height.
    expect(pickVariant({ width: 100, height: 1600 })).toBe(MediaVariant.Large)
  })

  it("returns the fallback when no positive dimension is provided", () => {
    expect(pickVariant()).toBe(MediaVariant.Medium)
    expect(pickVariant({ width: 0, height: 0 })).toBe(MediaVariant.Medium)
    expect(pickVariant({ fallback: MediaVariant.Large })).toBe(MediaVariant.Large)
    expect(
      pickVariant({ width: null, height: undefined, fallback: MediaVariant.Small }),
    ).toBe(MediaVariant.Small)
  })
})

describe("variantCandidateUrls", () => {
  const base = "media/user1/blip1/20240815143022"

  beforeEach(() => {
    vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test/")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("lists WebP siblings from the preferred variant upward, then a displayable original", () => {
    expect(
      variantCandidateUrls(base, MediaVariant.Micro, "image/jpeg"),
    ).toEqual([
      `https://cdn.test/${base}-micro.webp`,
      `https://cdn.test/${base}-small.webp`,
      `https://cdn.test/${base}-medium.webp`,
      `https://cdn.test/${base}-large.webp`,
      `https://cdn.test/${base}-original.jpg`,
    ])
  })

  it("skips the original when the browser cannot render it (e.g. HEIC)", () => {
    expect(
      variantCandidateUrls(base, MediaVariant.Micro, "image/heic"),
    ).toEqual([
      `https://cdn.test/${base}-micro.webp`,
      `https://cdn.test/${base}-small.webp`,
      `https://cdn.test/${base}-medium.webp`,
      `https://cdn.test/${base}-large.webp`,
    ])
  })

  it("starts the chain at the requested variant", () => {
    expect(variantFallbackChain(MediaVariant.Small)).toEqual([
      MediaVariant.Small,
      MediaVariant.Medium,
      MediaVariant.Large,
    ])
  })
})
