import {
  CANONICAL_BOOK_NAMES,
  type CanonicalBookName,
} from "@/lib/bible/book-map"
import { normalizeReference } from "@/lib/bible/normalize-reference"

const canonicalBookSet = new Set<string>(CANONICAL_BOOK_NAMES)

export function buildNormalizedReferencePreview(
  book: string,
  chapterValue: string,
  startVerseValue: string,
  endVerseValue: string,
): string | null {
  const chapter = Number.parseInt(chapterValue, 10)
  const startVerse = Number.parseInt(startVerseValue, 10)

  if (
    !book ||
    !canonicalBookSet.has(book) ||
    !Number.isFinite(chapter) ||
    chapter <= 0 ||
    !Number.isFinite(startVerse) ||
    startVerse <= 0
  ) {
    return null
  }

  const endVerseTrimmed = endVerseValue.trim()
  let endVerse: number | null = null

  if (endVerseTrimmed.length > 0) {
    const parsedEndVerse = Number.parseInt(endVerseTrimmed, 10)
    if (!Number.isFinite(parsedEndVerse) || parsedEndVerse <= 0 || parsedEndVerse < startVerse) {
      return null
    }

    endVerse = parsedEndVerse
  }

  return normalizeReference({
    book: book as CanonicalBookName,
    chapter,
    startVerse,
    endVerse,
  })
}
