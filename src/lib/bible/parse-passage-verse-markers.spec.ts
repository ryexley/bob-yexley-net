import { describe, expect, it } from "vitest"
import { parsePassageVerseBlocks, parsePassageVerseMarkers } from "@/lib/bible/parse-passage-verse-markers"

describe("parsePassageVerseMarkers", () => {
  it("splits bracketed verse numbers from passage text", () => {
    expect(
      parsePassageVerseMarkers(
        "[32] Behold, the hour is coming, [33] I have said these things to you, that in me you may have peace. (ESV)",
      ),
    ).toEqual([
      { type: "verse", value: "32" },
      { type: "text", value: " Behold, the hour is coming, " },
      { type: "verse", value: "33" },
      {
        type: "text",
        value:
          " I have said these things to you, that in me you may have peace. (ESV)",
      },
    ])
  })

  it("returns plain text when no verse markers are present", () => {
    expect(parsePassageVerseMarkers("Jesus wept. (ESV)")).toEqual([
      { type: "text", value: "Jesus wept. (ESV)" },
    ])
  })

  it("returns an empty array for empty input", () => {
    expect(parsePassageVerseMarkers("")).toEqual([])
  })
})

describe("parsePassageVerseBlocks", () => {
  it("groups each verse marker with the first word of its text", () => {
    expect(
      parsePassageVerseBlocks(
        "[32] Behold, the hour is coming, [33] I have said these things to you. (ESV)",
      ),
    ).toEqual([
      {
        type: "verse",
        verse: "32",
        firstWord: "Behold,",
        rest: " the hour is coming, ",
      },
      {
        type: "verse",
        verse: "33",
        firstWord: "I",
        rest: " have said these things to you. (ESV)",
      },
    ])
  })
})
