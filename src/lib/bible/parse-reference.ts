import { resolveBookAlias, type CanonicalBookName } from "@/lib/bible/book-map"

export interface ParsedReference {
  book: string
  chapter: number
  startVerse: number
  endVerse: number | null
}

export const SINGLE_CHAPTER_BOOKS = new Set<CanonicalBookName>([
  "Obadiah",
  "Philemon",
  "2 John",
  "3 John",
  "Jude",
])

const NUMERIC_SUFFIX = /((?:\d+:)?\d+(?:-\d+)*)\s*$/

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeRomanNumeralPrefix(bookPart: string): string {
  return bookPart
    .replace(/^III\s+/i, "3 ")
    .replace(/^II\s+/i, "2 ")
    .replace(/^I\s+/i, "1 ")
}

function splitBookAndNumeric(
  input: string,
): { bookPart: string; numericPart: string } | null {
  const match = input.match(NUMERIC_SUFFIX)
  if (!match || match.index === undefined) {
    return null
  }

  const bookPart = input.slice(0, match.index).trim()
  const numericPart = match[1]

  if (!bookPart || !numericPart) {
    return null
  }

  return { bookPart, numericPart }
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== value) {
    return null
  }

  return parsed
}

function parseNumericPortion(
  numericPart: string,
  book: CanonicalBookName,
): Pick<ParsedReference, "chapter" | "startVerse" | "endVerse"> | null {
  if (numericPart.includes(":")) {
    const [chapterPart, versePart] = numericPart.split(":", 2)
    const chapter = parsePositiveInteger(chapterPart)
    if (chapter === null || !versePart) {
      return null
    }

    const verseMatch = versePart.match(/^(\d+)(?:-(\d+))?$/)
    if (!verseMatch) {
      return null
    }

    const startVerse = parsePositiveInteger(verseMatch[1])
    if (startVerse === null) {
      return null
    }

    let endVerse: number | null = null
    if (verseMatch[2] !== undefined) {
      endVerse = parsePositiveInteger(verseMatch[2])
      if (endVerse === null || endVerse < startVerse) {
        return null
      }
    }

    return { chapter, startVerse, endVerse }
  }

  const bareNumber = parsePositiveInteger(numericPart)
  if (bareNumber === null) {
    return null
  }

  if (SINGLE_CHAPTER_BOOKS.has(book)) {
    return {
      chapter: 1,
      startVerse: bareNumber,
      endVerse: null,
    }
  }

  return {
    chapter: bareNumber,
    startVerse: 1,
    endVerse: null,
  }
}

export function parseReference(raw: string): ParsedReference | null {
  const normalized = collapseWhitespace(raw)
  if (!normalized) {
    return null
  }

  const parts = splitBookAndNumeric(normalized)
  if (!parts) {
    return null
  }

  const book = resolveBookAlias(normalizeRomanNumeralPrefix(parts.bookPart))
  if (!book) {
    return null
  }

  const numeric = parseNumericPortion(parts.numericPart, book)
  if (!numeric) {
    return null
  }

  return {
    book,
    ...numeric,
  }
}
