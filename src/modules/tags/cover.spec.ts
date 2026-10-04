import { describe, expect, it } from "vitest"
import { resolveTagCoverUrl } from "./cover"

describe("resolveTagCoverUrl", () => {
  const base = "https://pub-example.r2.dev/"

  it("returns null for empty values", () => {
    expect(resolveTagCoverUrl(null, base)).toBeNull()
    expect(resolveTagCoverUrl(undefined, base)).toBeNull()
    expect(resolveTagCoverUrl("   ", base)).toBeNull()
  })

  it("passes absolute URLs through", () => {
    expect(resolveTagCoverUrl("https://example.com/a.jpg", base)).toBe(
      "https://example.com/a.jpg",
    )
    expect(resolveTagCoverUrl("HTTP://example.com/a.jpg", base)).toBe(
      "HTTP://example.com/a.jpg",
    )
  })

  it("joins storage keys onto the media base without double slashes", () => {
    expect(resolveTagCoverUrl("media/u/tags/faith.jpg", base)).toBe(
      "https://pub-example.r2.dev/media/u/tags/faith.jpg",
    )
    expect(resolveTagCoverUrl("/media/u/tags/faith.jpg", base)).toBe(
      "https://pub-example.r2.dev/media/u/tags/faith.jpg",
    )
  })

  it("returns null for a key when no media base is configured", () => {
    expect(resolveTagCoverUrl("media/u/tags/faith.jpg", "")).toBeNull()
  })
})
