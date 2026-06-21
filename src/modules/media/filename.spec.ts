import { beforeEach, describe, expect, it, vi } from "vitest"

// exifr's `parse` is mocked so the naming logic is exercised deterministically,
// independent of any real image bytes. A separate real-exifr integration test
// lives in filename.exif.spec.ts.
const { mockParse } = vi.hoisted(() => ({ mockParse: vi.fn() }))
// Source reads `exifr.parse` off the default import (CJS interop for Vite SSR),
// so the mock exposes both the default object and the named export.
vi.mock("exifr", () => ({ default: { parse: mockParse }, parse: mockParse }))

import {
  createFilenameAllocator,
  extensionForFile,
  formatClipboardTimestamp,
  formatExifTimestamp,
  mediaTypeForFile,
  shouldProcess,
} from "./filename"

const bytes = () => new Uint8Array([0xff, 0xd8, 0xff]) // arbitrary non-empty buffer

describe("extensionForFile", () => {
  it("prefers a real extension from the filename", () => {
    expect(extensionForFile({ name: "IMG_1234.JPEG", type: "image/jpeg" })).toBe(
      "jpeg",
    )
  })

  it("falls back to the mime map when the name has no extension", () => {
    expect(extensionForFile({ name: "blob", type: "image/webp" })).toBe("webp")
    expect(extensionForFile({ name: "", type: "video/quicktime" })).toBe("mov")
    expect(extensionForFile({ name: null, type: "image/heic" })).toBe("heic")
  })

  it("defaults clipboard pastes with no other signal to png", () => {
    expect(extensionForFile({ name: "", type: "" }, { isClipboard: true })).toBe(
      "png",
    )
  })

  it("falls back to bin for an unknown, non-clipboard file", () => {
    expect(extensionForFile({ name: "mystery", type: "" })).toBe("bin")
  })

  it("ignores junk that is not a plausible extension", () => {
    expect(
      extensionForFile({ name: "file.thisisnotanext", type: "image/png" }),
    ).toBe("png")
  })
})

describe("mediaTypeForFile / shouldProcess", () => {
  it("classifies gif by mime or extension", () => {
    expect(mediaTypeForFile({ type: "image/gif" })).toBe("gif")
    expect(mediaTypeForFile({ name: "anim.GIF", type: "" })).toBe("gif")
  })

  it("classifies video by mime or extension", () => {
    expect(mediaTypeForFile({ type: "video/mp4" })).toBe("video")
    expect(mediaTypeForFile({ name: "clip.mov", type: "" })).toBe("video")
  })

  it("classifies everything else as image", () => {
    expect(mediaTypeForFile({ type: "image/jpeg" })).toBe("image")
    expect(mediaTypeForFile({ name: "photo.heic", type: "" })).toBe("image")
  })

  it("only processes images server-side", () => {
    expect(shouldProcess({ type: "image/jpeg" })).toBe(true)
    expect(shouldProcess({ type: "image/gif" })).toBe(false)
    expect(shouldProcess({ type: "video/mp4" })).toBe(false)
  })
})

describe("timestamp formatting", () => {
  it("formats EXIF dates from their UTC components (tz-independent)", () => {
    // exifr encodes a no-offset EXIF datetime into the Date's UTC fields.
    const exif = new Date(Date.UTC(2024, 7, 15, 14, 30, 22))
    expect(formatExifTimestamp(exif)).toBe("20240815143022")
  })

  it("formats clipboard timestamps from local components", () => {
    const local = new Date(2024, 0, 2, 3, 4, 5)
    expect(formatClipboardTimestamp(local)).toBe("20240102030405")
  })
})

describe("createFilenameAllocator", () => {
  beforeEach(() => {
    mockParse.mockReset()
  })

  it("uses the EXIF timestamp when present", async () => {
    mockParse.mockResolvedValue({
      DateTimeOriginal: new Date(Date.UTC(2024, 7, 15, 14, 30, 22)),
    })
    const allocator = createFilenameAllocator()

    const result = await allocator.allocate({
      file: { name: "IMG.jpg", type: "image/jpeg" },
      blipId: "20240815143000000",
      data: bytes(),
    })

    expect(result).toEqual({ name: "20240815143022", ext: "jpg" })
  })

  it("suffixes collisions within the same blip (burst photos)", async () => {
    mockParse.mockResolvedValue({
      DateTimeOriginal: new Date(Date.UTC(2024, 7, 15, 14, 30, 22)),
    })
    const allocator = createFilenameAllocator()
    const blipId = "20240815143000000"

    const a = await allocator.allocate({
      file: { name: "a.jpg", type: "image/jpeg" },
      blipId,
      data: bytes(),
    })
    const b = await allocator.allocate({
      file: { name: "b.jpg", type: "image/jpeg" },
      blipId,
      data: bytes(),
    })
    const c = await allocator.allocate({
      file: { name: "c.jpg", type: "image/jpeg" },
      blipId,
      data: bytes(),
    })

    expect(a.name).toBe("20240815143022")
    expect(b.name).toBe("20240815143022-1")
    expect(c.name).toBe("20240815143022-2")
  })

  it("falls back to {blipId}-{n} when there is no EXIF", async () => {
    mockParse.mockResolvedValue(undefined)
    const allocator = createFilenameAllocator()
    const blipId = "20240815143000000"

    const first = await allocator.allocate({
      file: { name: "no-exif.png", type: "image/png" },
      blipId,
      data: bytes(),
    })
    const second = await allocator.allocate({
      file: { name: "also-none.png", type: "image/png" },
      blipId,
      data: bytes(),
    })

    expect(first).toEqual({ name: `${blipId}-1`, ext: "png" })
    expect(second).toEqual({ name: `${blipId}-2`, ext: "png" })
  })

  it("uses sc- naming for clipboard pastes and skips EXIF", async () => {
    const allocator = createFilenameAllocator()

    const result = await allocator.allocate({
      file: { name: "", type: "image/png" },
      blipId: "20240815143000000",
      isClipboard: true,
    })

    expect(result.name).toMatch(/^sc-\d{14}$/)
    expect(result.ext).toBe("png")
    expect(mockParse).not.toHaveBeenCalled()
  })

  it("does not attempt EXIF for videos (fallback naming)", async () => {
    const allocator = createFilenameAllocator()
    const blipId = "20240815143000000"

    const result = await allocator.allocate({
      file: { name: "movie.mp4", type: "video/mp4" },
      blipId,
      data: bytes(),
    })

    expect(result).toEqual({ name: `${blipId}-1`, ext: "mp4" })
    expect(mockParse).not.toHaveBeenCalled()
  })

  it("scopes collision + fallback counters per blip", async () => {
    mockParse.mockResolvedValue(undefined)
    const allocator = createFilenameAllocator()

    const blipA = await allocator.allocate({
      file: { name: "x.png", type: "image/png" },
      blipId: "blipA",
      data: bytes(),
    })
    const blipB = await allocator.allocate({
      file: { name: "y.png", type: "image/png" },
      blipId: "blipB",
      data: bytes(),
    })

    expect(blipA.name).toBe("blipA-1")
    expect(blipB.name).toBe("blipB-1")
  })

  it("seedExisting reserves committed storage keys across sessions", async () => {
    const allocator = createFilenameAllocator()
    const blipId = "20240815143000000"
    const userId = "user-1"

    allocator.seedExisting(blipId, [
      `media/${userId}/${blipId}/${blipId}-1`,
      `media/${userId}/${blipId}/20240815143022`,
    ])

    mockParse.mockResolvedValue(undefined)
    const nextVideo = await allocator.allocate({
      file: { name: "clip.mp4", type: "video/mp4" },
      blipId,
      data: bytes(),
    })

    mockParse.mockResolvedValue({
      DateTimeOriginal: new Date(Date.UTC(2024, 7, 15, 14, 30, 22)),
    })
    const nextPhoto = await allocator.allocate({
      file: { name: "burst.jpg", type: "image/jpeg" },
      blipId,
      data: bytes(),
    })

    expect(nextVideo.name).toBe(`${blipId}-2`)
    expect(nextPhoto.name).toBe("20240815143022-1")
  })
})
