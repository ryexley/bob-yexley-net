import { describe, expect, it } from "vitest"
import {
  canonicalizeXEmbed,
  coerceXEmbedProps,
  findXEmbedRegions,
  parseLeadingXEmbed,
  parseLeadingXStatusUrl,
  parseXEmbedBlock,
  parseXStatusUrl,
} from "./x-embed-syntax"

describe("parseXStatusUrl", () => {
  it("accepts x.com status URLs", () => {
    expect(
      parseXStatusUrl("https://x.com/stephenthompson/status/1234567890"),
    ).toEqual({
      id: "1234567890",
      handle: "stephenthompson",
      url: "https://x.com/stephenthompson/status/1234567890",
    })
  })

  it("accepts twitter.com, mobile, and query strings", () => {
    expect(
      parseXStatusUrl(
        "https://mobile.twitter.com/foo_bar/status/99?s=20&t=abc",
      ),
    ).toEqual({
      id: "99",
      handle: "foo_bar",
      url: "https://x.com/foo_bar/status/99",
    })
  })

  it("accepts i/web/status URLs and photo suffixes", () => {
    expect(parseXStatusUrl("https://x.com/i/web/status/42/photo/1")).toEqual({
      id: "42",
      url: "https://x.com/i/web/status/42",
    })
  })

  it("accepts URLs wrapped in angle brackets", () => {
    expect(parseXStatusUrl("<https://x.com/someone/status/7>")).toMatchObject({
      id: "7",
      handle: "someone",
    })
  })

  it("rejects profiles, search links, and surrounding prose", () => {
    expect(parseXStatusUrl("https://x.com/stephenthompson")).toBeNull()
    expect(parseXStatusUrl("https://x.com/search?q=alabama")).toBeNull()
    expect(parseXStatusUrl("see https://x.com/foo/status/1 please")).toBeNull()
  })
})

describe("x embed shorthand", () => {
  it("parses a canonical {x:{url}} block", () => {
    expect(
      parseXEmbedBlock('{x:{url:"https://x.com/stephenthompson/status/123"}}'),
    ).toEqual({
      id: "123",
      handle: "stephenthompson",
      url: "https://x.com/stephenthompson/status/123",
    })
  })

  it("parses an id-only object", () => {
    expect(coerceXEmbedProps({ id: "99" })).toEqual({
      id: "99",
      url: "https://x.com/i/web/status/99",
    })
  })

  it("canonicalizes to a compact url form", () => {
    expect(
      canonicalizeXEmbed({
        id: "1",
        handle: "a",
        url: "https://x.com/a/status/1",
      }),
    ).toBe('{x:{url:"https://x.com/a/status/1"}}')
  })

  it("reads a leading block when more markdown follows", () => {
    const parsed = parseLeadingXEmbed(
      '{x:{url:"https://x.com/a/status/1"}}\n\nmore prose',
    )
    expect(parsed?.props.id).toBe("1")
    expect(parsed?.raw).toBe('{x:{url:"https://x.com/a/status/1"}}')
  })

  it("reads a leading standalone status URL", () => {
    const parsed = parseLeadingXStatusUrl(
      "https://x.com/a/status/1\n\nmore prose",
    )
    expect(parsed?.props.id).toBe("1")
    expect(parsed?.raw).toBe("https://x.com/a/status/1\n")
  })

  it("finds embed regions in mixed content", () => {
    const content =
      'intro\n{x:{url:"https://x.com/a/status/1"}}\n\n{x:{url:"https://x.com/b/status/2"}}'
    const regions = findXEmbedRegions(content)
    expect(regions).toHaveLength(2)
    expect(regions[0]?.start).toBe(content.indexOf("{x:"))
  })
})
