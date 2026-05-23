import { describe, expect, it } from "vitest"
import { normalizeReference } from "@/lib/bible/normalize-reference"
import { parseReference } from "@/lib/bible/parse-reference"

describe("normalizeReference", () => {
  it.each([
    {
      parsed: {
        book: "Romans",
        chapter: 8,
        startVerse: 28,
        endVerse: 30,
      },
      expected: "Romans 8:28-30",
    },
    {
      parsed: {
        book: "Jude",
        chapter: 1,
        startVerse: 3,
        endVerse: null,
      },
      expected: "Jude 1:3",
    },
    {
      parsed: {
        book: "1 Samuel",
        chapter: 7,
        startVerse: 12,
        endVerse: null,
      },
      expected: "1 Samuel 7:12",
    },
    {
      parsed: {
        book: "2 Peter",
        chapter: 1,
        startVerse: 5,
        endVerse: 7,
      },
      expected: "2 Peter 1:5-7",
    },
    {
      parsed: {
        book: "Song of Solomon",
        chapter: 2,
        startVerse: 1,
        endVerse: null,
      },
      expected: "Song of Solomon 2:1",
    },
    {
      parsed: {
        book: "Psalm",
        chapter: 23,
        startVerse: 1,
        endVerse: null,
      },
      expected: "Psalm 23:1",
    },
  ])("formats $expected", ({ parsed, expected }) => {
    expect(normalizeReference(parsed)).toBe(expected)
  })

  describe("integration with parseReference", () => {
    it.each([
      { input: "Rom 8:28-30", expected: "Romans 8:28-30" },
      { input: "2PET 1:5-7", expected: "2 Peter 1:5-7" },
      { input: "Jude 3", expected: "Jude 1:3" },
      { input: "1 Cor 13:4-7", expected: "1 Corinthians 13:4-7" },
      { input: "II Sam 7:12", expected: "2 Samuel 7:12" },
      { input: "John 3:16", expected: "John 3:16" },
      { input: "Obadiah 21", expected: "Obadiah 1:21" },
    ])("normalizes parsed $input to $expected", ({ input, expected }) => {
      const parsed = parseReference(input)
      expect(parsed).not.toBeNull()
      expect(normalizeReference(parsed!)).toBe(expected)
    })
  })
})
