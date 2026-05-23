import { describe, expect, it } from "vitest"
import { parseBlipMarkdown } from "./marked-blips"

describe("parseBlipMarkdown", () => {
  it("renders ==highlight== as marked highlight text", () => {
    expect(parseBlipMarkdown("Before ==highlighted== after")).toContain(
      "<mark class=\"highlight\">highlighted</mark>",
    )
  })

  it("renders nested inline markdown inside highlight text", () => {
    expect(parseBlipMarkdown("==**important**==")).toContain(
      "<mark class=\"highlight\"><strong>important</strong></mark>",
    )
  })

  it("renders audio embed shorthand as a mount point", () => {
    const html = parseBlipMarkdown(
      "{audio:{ src: \"/audio/ep-1.mp3\", title: \"Episode 1\" }}",
    )

    expect(html).toContain("blip-audio-player")
    expect(html).toContain("data-audio-player-props=")
    expect(decodeURIComponent(html.match(/data-audio-player-props="([^"]+)"/)?.[1] ?? "")).toContain(
      "\"title\":\"Episode 1\"",
    )
  })

  it("renders multi-line paragraph-split audio embed shorthand", () => {
    const html = parseBlipMarkdown(`{

audio: {

src: "https://example.com/ep-1.mp3",
title: "Episode 1"

}

}`)

    expect(html).toContain("blip-audio-player")
    expect(decodeURIComponent(html.match(/data-audio-player-props="([^"]+)"/)?.[1] ?? "")).toContain(
      "\"title\":\"Episode 1\"",
    )
  })

  it("renders audio embeds when followed by more markdown content", () => {
    const audio =
      "{audio:{src:\"https://example.com/ep-1.mp3\",title:\"Death and Judgment\"}}"
    const html = parseBlipMarkdown(`## Session 1

${audio}

---

*The audio for this sermon series belongs to The Journey Church.*`)

    expect(html).toContain("blip-audio-player")
    expect(html).toContain("<hr>")
    expect(html).not.toMatch(/<p>\{audio:/)
  })

  it("leaves invalid audio embed syntax as markdown text", () => {
    expect(parseBlipMarkdown("{audio:{ title: \"Missing src\" }}")).toContain(
      "Missing src",
    )
  })

  it("wraps scripture references in spans with structured data attributes", () => {
    const html = parseBlipMarkdown(
      "As it says in Romans 8:28-30, all things work together...",
    )

    expect(html).toContain('class="scripture-reference"')
    expect(html).toContain('data-book="Romans"')
    expect(html).toContain('data-chapter="8"')
    expect(html).toContain('data-start-verse="28"')
    expect(html).toContain('data-end-verse="30"')
    expect(html).toContain('data-normalized="Romans 8:28-30"')
    expect(html).toContain(">Romans 8:28-30</span>")
  })

  it.each([
    {
      markdown: "See 2PET 1:5-7 for the list.",
      displayText: "2PET 1:5-7",
      book: "2 Peter",
      normalized: "2 Peter 1:5-7",
      endVerse: "7",
    },
    {
      markdown: "Jude 3 is a favorite.",
      displayText: "Jude 3",
      book: "Jude",
      normalized: "Jude 1:3",
      endVerse: null,
    },
    {
      markdown: "Compare 1 Cor 13:4-7 with love.",
      displayText: "1 Cor 13:4-7",
      book: "1 Corinthians",
      normalized: "1 Corinthians 13:4-7",
      endVerse: "7",
    },
  ])(
    "renders $displayText with scripture metadata",
    ({ markdown, displayText, book, normalized, endVerse }) => {
      const html = parseBlipMarkdown(markdown)

      expect(html).toContain(`data-book="${book}"`)
      expect(html).toContain(`data-normalized="${normalized}"`)
      expect(html).toContain(`>${displayText}</span>`)

      if (endVerse) {
        expect(html).toContain(`data-end-verse="${endVerse}"`)
      } else {
        expect(html).not.toContain("data-end-verse=")
      }
    },
  )

  it("does not transform scripture references inside inline code", () => {
    const html = parseBlipMarkdown("Use `Romans 8:28` in code samples.")

    expect(html).toContain("<code>Romans 8:28</code>")
    expect(html).not.toContain('class="scripture-reference"')
  })

  it("does not transform scripture references inside code blocks", () => {
    const html = parseBlipMarkdown("```\nRomans 8:28\n```")

    expect(html).toContain("<code")
    expect(html).toContain("Romans 8:28")
    expect(html).not.toContain('class="scripture-reference"')
  })
})
