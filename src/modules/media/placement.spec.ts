import { describe, expect, it } from "vitest"
import {
  galleryMedia,
  inlineMediaKeys,
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

  it("treats media embedded in the document as inline even with stale placement", () => {
    const content =
      'Text\n\n{media:{key:"media/u/b/photo",type:"image",mime:"image/jpeg"}}'
    const rows = [
      {
        id: "embedded",
        storage_key: "media/u/b/photo",
        placement: MEDIA_PLACEMENT.Gallery,
      },
      {
        id: "gallery",
        storage_key: "media/u/b/other",
        placement: MEDIA_PLACEMENT.Gallery,
      },
    ]

    expect([...inlineMediaKeys(content)]).toEqual(["media/u/b/photo"])
    expect(galleryMedia(rows, content).map(row => row.id)).toEqual(["gallery"])
  })

  it("parses unknown values as gallery", () => {
    expect(parseMediaPlacement("inline")).toBe("inline")
    expect(parseMediaPlacement("nope")).toBe("gallery")
    expect(parseMediaPlacement(undefined)).toBe("gallery")
  })
})
