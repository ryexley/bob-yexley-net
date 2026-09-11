import { describe, expect, it } from "vitest"
import {
  galleryMedia,
  isGalleryPlacement,
  isInlinePlacement,
  MEDIA_PLACEMENT,
  parseMediaPlacement,
} from "./placement"

describe("media placement", () => {
  it("treats missing placement as gallery", () => {
    expect(isGalleryPlacement({})).toBe(true)
    expect(isGalleryPlacement({ placement: null })).toBe(true)
    expect(isGalleryPlacement({ placement: "gallery" })).toBe(true)
    expect(isInlinePlacement({ placement: "inline" })).toBe(true)
    expect(isInlinePlacement({})).toBe(false)
  })

  it("filters gallery rows and keeps inline out", () => {
    const rows = [
      { id: "a", placement: MEDIA_PLACEMENT.Gallery },
      { id: "b", placement: MEDIA_PLACEMENT.Inline },
      { id: "c" },
    ]
    expect(galleryMedia(rows).map(row => row.id)).toEqual(["a", "c"])
  })

  it("parses unknown values as gallery", () => {
    expect(parseMediaPlacement("inline")).toBe("inline")
    expect(parseMediaPlacement("nope")).toBe("gallery")
    expect(parseMediaPlacement(undefined)).toBe("gallery")
  })
})
