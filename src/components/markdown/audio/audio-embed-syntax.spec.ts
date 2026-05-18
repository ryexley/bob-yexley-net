import { describe, expect, it } from "vitest"
import {
  coerceAudioPlayerProps,
  extractAudioEmbedBlock,
  normalizeAudioEmbedsInMarkdown,
  parseAudioEmbedBlock,
  parseAudioEmbedObjectLiteral,
} from "@/components/markdown/audio/audio-embed-syntax"

const multiLineAudioEmbed = `{
audio: {
src: "https://example.com/ep-1.mp3",
coverImage: "https://example.com/cover.jpg",
artist: "The Journey Church",
series: "Heaven and Hell",
title: "Death and Judgment"
}
}`

describe("extractAudioEmbedBlock", () => {
  it("extracts a standalone audio embed block", () => {
    const source =
      "{audio:{ src: \"/audio/ep-1.mp3\", title: \"Episode 1\", storageKey: \"ep-1\" }}"

    expect(extractAudioEmbedBlock(source)).toEqual({
      raw: source,
      objectLiteral:
        "{ src: \"/audio/ep-1.mp3\", title: \"Episode 1\", storageKey: \"ep-1\" }",
    })
  })

  it("extracts multi-line audio embed blocks with flexible whitespace", () => {
    const block = extractAudioEmbedBlock(multiLineAudioEmbed)
    expect(block).not.toBeNull()
    expect(parseAudioEmbedBlock(block?.raw ?? "")).toEqual({
      src: "https://example.com/ep-1.mp3",
      coverImage: "https://example.com/cover.jpg",
      artist: "The Journey Church",
      series: "Heaven and Hell",
      title: "Death and Judgment",
    })
  })

  it("rejects blocks with trailing content on the same line", () => {
    expect(
      extractAudioEmbedBlock("{audio:{ src: \"/audio/ep-1.mp3\" }} trailing"),
    ).toBeNull()
  })
})

describe("normalizeAudioEmbedsInMarkdown", () => {
  it("collapses paragraph-split audio embeds into canonical single-line syntax", () => {
    const markdown = `Intro paragraph

{

audio: {

src: "https://example.com/ep-1.mp3",
title: "Episode 1"

}

}

Next paragraph`

    expect(normalizeAudioEmbedsInMarkdown(markdown)).toContain(
      "{audio:{src:\"https://example.com/ep-1.mp3\",title:\"Episode 1\"}}",
    )
    expect(normalizeAudioEmbedsInMarkdown(markdown)).not.toContain("{\naudio:")
  })
})

describe("parseAudioEmbedObjectLiteral", () => {
  it("parses JS object literals with unquoted keys and single quotes", () => {
    expect(
      parseAudioEmbedObjectLiteral(
        "{ src: '/audio/ep-1.mp3', title: 'Episode 1', volume: 0.75 }",
      ),
    ).toEqual({
      src: "/audio/ep-1.mp3",
      title: "Episode 1",
      volume: 0.75,
    })
  })
})

describe("coerceAudioPlayerProps", () => {
  it("omits storageKey when not provided", () => {
    expect(coerceAudioPlayerProps({ src: "/audio/ep-1.mp3" })).toEqual({
      src: "/audio/ep-1.mp3",
    })
  })

  it("returns null when src is missing", () => {
    expect(coerceAudioPlayerProps({ title: "Episode 1" })).toBeNull()
  })
})

describe("parseAudioEmbedBlock", () => {
  it("returns coerced audio player props from shorthand syntax", () => {
    expect(
      parseAudioEmbedBlock(
        "{audio:{ src: \"/audio/ep-1.mp3\", title: \"Episode 1\", scrubSeconds: 15 }}",
      ),
    ).toEqual({
      src: "/audio/ep-1.mp3",
      title: "Episode 1",
      scrubSeconds: 15,
    })
  })
})
