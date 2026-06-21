import { afterEach, describe, expect, it } from "vitest"
import { extractThumbnail } from "./thumbnail-extract"

/**
 * The real decode path needs a browser (canvas + media-element events), so these
 * cover the guard behavior only: images never extract, and an environment without
 * `URL.createObjectURL` (SSR / jsdom default) degrades to `null` so callers fall
 * back to pre-thumb rendering. The video/GIF wiring itself is exercised via the
 * injectable `extractThumbnail` seam in `upload-store.spec.ts`.
 */
const file = (type: string) => new File([new Uint8Array([1, 2, 3])], "f", { type })

describe("extractThumbnail", () => {
  const original = URL.createObjectURL

  afterEach(() => {
    URL.createObjectURL = original
  })

  it("never extracts for images", async () => {
    expect(await extractThumbnail(file("image/jpeg"), "image")).toBeNull()
  })

  it("returns null when object URLs are unavailable", async () => {
    // @ts-expect-error — simulate an environment without createObjectURL.
    URL.createObjectURL = undefined
    expect(await extractThumbnail(file("video/mp4"), "video")).toBeNull()
    expect(await extractThumbnail(file("image/gif"), "gif")).toBeNull()
  })
})
