import type { ParsedReference } from "@/lib/bible/parse-reference"

export function normalizeReference(parsed: ParsedReference): string {
  const { book, chapter, startVerse, endVerse } = parsed

  if (endVerse !== null) {
    return `${book} ${chapter}:${startVerse}-${endVerse}`
  }

  return `${book} ${chapter}:${startVerse}`
}
