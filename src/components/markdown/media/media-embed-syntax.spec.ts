import { describe, expect, it } from "vitest"
import {
  canonicalizeMediaEmbed,
  coerceMediaEmbedProps,
  extractMediaEmbedBlock,
  normalizeMediaEmbedsInMarkdown,
  parseMediaEmbedBlock,
  readLeadingMediaEmbedBlock,
} from "./media-embed-syntax"

describe("extractMediaEmbedBlock", () => {
  it("extracts a standalone media embed block", () => {
    const source =
      '{media:{ key: "media/u/b/sc-20260910155200", type: "image", mime: "image/png" }}'

    expect(extractMediaEmbedBlock(source)).toEqual({
      raw: source,
      objectLiteral:
        '{ key: "media/u/b/sc-20260910155200", type: "image", mime: "image/png" }',
    })
  })

  it("reads a leading media embed when more markdown follows", () => {
    const source = `{media:{ key: "media/u/b/a", type: "gif" }}

Next paragraph`

    expect(readLeadingMediaEmbedBlock(source)?.raw).toBe(
      '{media:{ key: "media/u/b/a", type: "gif" }}',
    )
    expect(extractMediaEmbedBlock(source)).toBeNull()
  })

  it("rejects blocks with trailing content on the same line", () => {
    expect(
      extractMediaEmbedBlock(
        '{media:{ key: "media/u/b/a", type: "image" }} trailing',
      ),
    ).toBeNull()
  })
})

describe("parseMediaEmbedBlock", () => {
  it("parses key, type, and mime", () => {
    expect(
      parseMediaEmbedBlock(
        '{media:{ key: "media/u/b/a", type: "video", mime: "video/mp4" }}',
      ),
    ).toEqual({
      key: "media/u/b/a",
      type: "video",
      mime: "video/mp4",
    })
  })

  it("rejects unknown types and missing keys", () => {
    expect(
      parseMediaEmbedBlock('{media:{ key: "media/u/b/a", type: "pdf" }}'),
    ).toBeNull()
    expect(parseMediaEmbedBlock('{media:{ type: "image" }}')).toBeNull()
  })
})

describe("normalizeMediaEmbedsInMarkdown", () => {
  it("collapses paragraph-split media embeds into canonical syntax", () => {
    const markdown = `Intro

{

media: {

key: "media/u/b/sc-1",
type: "image",
mime: "image/png"

}

}

After`

    const normalized = normalizeMediaEmbedsInMarkdown(markdown)
    expect(normalized).toContain(
      canonicalizeMediaEmbed({
        key: "media/u/b/sc-1",
        type: "image",
        mime: "image/png",
      }),
    )
    expect(normalized).not.toContain("{\nmedia:")
  })

  it("drops leading blank lines before a media-only embed", () => {
    const embed = canonicalizeMediaEmbed({
      key: "media/u/b/a",
      type: "gif",
      mime: "image/gif",
    })
    expect(normalizeMediaEmbedsInMarkdown(`\n\n${embed}`)).toBe(embed)
  })
})

describe("coerceMediaEmbedProps", () => {
  it("accepts the three media types", () => {
    expect(coerceMediaEmbedProps({ key: "a", type: "image" })).toEqual({
      key: "a",
      type: "image",
    })
    expect(coerceMediaEmbedProps({ key: "a", type: "gif" })?.type).toBe("gif")
    expect(coerceMediaEmbedProps({ key: "a", type: "video" })?.type).toBe(
      "video",
    )
  })

  it("parses size and alignment, omitting column-width defaults", () => {
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        size: 50,
        align: "center",
      }),
    ).toEqual({
      key: "a",
      type: "image",
      size: "50",
      align: "center",
    })
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "gif",
        size: "100",
        align: "left",
      }),
    ).toEqual({
      key: "a",
      type: "gif",
    })
  })

  it("persists lightbox only when enabled", () => {
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        lightbox: true,
      }),
    ).toEqual({
      key: "a",
      type: "image",
      lightbox: true,
    })
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        lightbox: false,
      }),
    ).toEqual({
      key: "a",
      type: "image",
    })
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        lightbox: "true",
      })?.lightbox,
    ).toBe(true)
  })

  it("accepts editor attr aliases for type and mime", () => {
    expect(
      coerceMediaEmbedProps({
        key: "a",
        mediaType: "video",
        mimeType: "video/mp4",
      }),
    ).toEqual({
      key: "a",
      type: "video",
      mime: "video/mp4",
    })
  })
})

describe("canonicalizeMediaEmbed", () => {
  it("persists non-default size, alignment, and lightbox", () => {
    expect(
      canonicalizeMediaEmbed({
        key: "media/u/b/a",
        type: "gif",
        size: "25",
        align: "right",
      }),
    ).toBe('{media:{key:"media/u/b/a",type:"gif",size:"25",align:"right"}}')
    expect(
      canonicalizeMediaEmbed({
        key: "media/u/b/a",
        type: "image",
        lightbox: true,
      }),
    ).toBe('{media:{key:"media/u/b/a",type:"image",lightbox:true}}')
  })
})
