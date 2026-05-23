import { describe, expect, it } from "vitest"
import { parseReference, SINGLE_CHAPTER_BOOKS } from "@/lib/bible/parse-reference"

describe("parseReference", () => {
  describe("standard chapter:verse references", () => {
    it.each([
      {
        input: "Romans 8:28",
        expected: {
          book: "Romans",
          chapter: 8,
          startVerse: 28,
          endVerse: null,
        },
      },
      {
        input: "Rom 8:28-30",
        expected: {
          book: "Romans",
          chapter: 8,
          startVerse: 28,
          endVerse: 30,
        },
      },
      {
        input: "2PET 1:5-7",
        expected: {
          book: "2 Peter",
          chapter: 1,
          startVerse: 5,
          endVerse: 7,
        },
      },
      {
        input: "2Pet1:5-7",
        expected: {
          book: "2 Peter",
          chapter: 1,
          startVerse: 5,
          endVerse: 7,
        },
      },
      {
        input: "1 Cor 13:4-7",
        expected: {
          book: "1 Corinthians",
          chapter: 13,
          startVerse: 4,
          endVerse: 7,
        },
      },
      {
        input: "1Cor13:4",
        expected: {
          book: "1 Corinthians",
          chapter: 13,
          startVerse: 4,
          endVerse: null,
        },
      },
      {
        input: "John 3:16",
        expected: {
          book: "John",
          chapter: 3,
          startVerse: 16,
          endVerse: null,
        },
      },
      {
        input: "1 Jn 3:16",
        expected: {
          book: "1 John",
          chapter: 3,
          startVerse: 16,
          endVerse: null,
        },
      },
      {
        input: "Genesis 1:1",
        expected: {
          book: "Genesis",
          chapter: 1,
          startVerse: 1,
          endVerse: null,
        },
      },
      {
        input: "GEN 1:1",
        expected: {
          book: "Genesis",
          chapter: 1,
          startVerse: 1,
          endVerse: null,
        },
      },
      {
        input: "Psalm 23:1",
        expected: {
          book: "Psalm",
          chapter: 23,
          startVerse: 1,
          endVerse: null,
        },
      },
      {
        input: "Song of Solomon 2:1",
        expected: {
          book: "Song of Solomon",
          chapter: 2,
          startVerse: 1,
          endVerse: null,
        },
      },
      {
        input: "SOS 2:1",
        expected: {
          book: "Song of Solomon",
          chapter: 2,
          startVerse: 1,
          endVerse: null,
        },
      },
    ])("parses $input", ({ input, expected }) => {
      expect(parseReference(input)).toEqual(expected)
    })
  })

  describe("roman numeral book prefixes", () => {
    it.each([
      {
        input: "II Cor 13:4",
        expected: {
          book: "2 Corinthians",
          chapter: 13,
          startVerse: 4,
          endVerse: null,
        },
      },
      {
        input: "I Sam 7:12",
        expected: {
          book: "1 Samuel",
          chapter: 7,
          startVerse: 12,
          endVerse: null,
        },
      },
      {
        input: "III Jn 1:4",
        expected: {
          book: "3 John",
          chapter: 1,
          startVerse: 4,
          endVerse: null,
        },
      },
    ])("parses $input", ({ input, expected }) => {
      expect(parseReference(input)).toEqual(expected)
    })
  })

  describe("single-chapter books", () => {
    it.each([...SINGLE_CHAPTER_BOOKS])("treats %s as a single-chapter book", book => {
      expect(parseReference(`${book} 3`)).toEqual({
        book,
        chapter: 1,
        startVerse: 3,
        endVerse: null,
      })
    })

    it.each([
      {
        input: "Jude 3",
        expected: {
          book: "Jude",
          chapter: 1,
          startVerse: 3,
          endVerse: null,
        },
      },
      {
        input: "Jude 1:3",
        expected: {
          book: "Jude",
          chapter: 1,
          startVerse: 3,
          endVerse: null,
        },
      },
      {
        input: "Obadiah 21",
        expected: {
          book: "Obadiah",
          chapter: 1,
          startVerse: 21,
          endVerse: null,
        },
      },
      {
        input: "Obad 1:21",
        expected: {
          book: "Obadiah",
          chapter: 1,
          startVerse: 21,
          endVerse: null,
        },
      },
      {
        input: "Philemon 1",
        expected: {
          book: "Philemon",
          chapter: 1,
          startVerse: 1,
          endVerse: null,
        },
      },
      {
        input: "2 John 1",
        expected: {
          book: "2 John",
          chapter: 1,
          startVerse: 1,
          endVerse: null,
        },
      },
      {
        input: "3 John 2",
        expected: {
          book: "3 John",
          chapter: 1,
          startVerse: 2,
          endVerse: null,
        },
      },
    ])("parses $input", ({ input, expected }) => {
      expect(parseReference(input)).toEqual(expected)
    })
  })

  describe("chapter-only references", () => {
    it("treats a bare chapter number as chapter 1 for multi-chapter books", () => {
      expect(parseReference("Romans 8")).toEqual({
        book: "Romans",
        chapter: 8,
        startVerse: 1,
        endVerse: null,
      })
    })
  })

  describe("normalization", () => {
    it("trims and collapses internal whitespace", () => {
      expect(parseReference("  Rom   8:28  ")).toEqual({
        book: "Romans",
        chapter: 8,
        startVerse: 28,
        endVerse: null,
      })
    })

    it("is case-insensitive for book aliases", () => {
      expect(parseReference("romans 8:28")).toEqual({
        book: "Romans",
        chapter: 8,
        startVerse: 28,
        endVerse: null,
      })
    })
  })

  describe("invalid references", () => {
    it.each([
      "",
      "   ",
      "NotABook 3:16",
      "Romans",
      "Romans 8:",
      "Romans :16",
      "Romans 0:16",
      "Romans 8:0",
      "Romans 8:28-10",
      "Romans 8:28-",
      "1 Cor",
    ])("returns null for %j", input => {
      expect(parseReference(input)).toBeNull()
    })
  })
})
