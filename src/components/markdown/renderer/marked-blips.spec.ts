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
})
