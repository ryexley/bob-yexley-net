export type PassageTextSegment =
  | { type: "text"; value: string }
  | { type: "verse"; value: string }

export type PassageVerseBlock =
  | { type: "text"; value: string }
  | { type: "verse"; verse: string; firstWord: string; rest: string }

const VERSE_MARKER_PATTERN = /\[(\d+)\]/g

export function parsePassageVerseMarkers(text: string): PassageTextSegment[] {
  if (!text) {
    return []
  }

  const segments: PassageTextSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(VERSE_MARKER_PATTERN)) {
    const index = match.index ?? 0

    if (index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, index),
      })
    }

    segments.push({
      type: "verse",
      value: match[1],
    })

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      value: text.slice(lastIndex),
    })
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }]
}

function splitLeadingWord(text: string): { firstWord: string; rest: string } {
  const match = text.match(/^(\s*\S+)([\s\S]*)$/)
  if (!match) {
    return { firstWord: "", rest: text }
  }

  return {
    firstWord: match[1].trim(),
    rest: match[2] ?? "",
  }
}

export function parsePassageVerseBlocks(text: string): PassageVerseBlock[] {
  const segments = parsePassageVerseMarkers(text)
  const blocks: PassageVerseBlock[] = []

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]

    if (segment.type === "text") {
      blocks.push({ type: "text", value: segment.value })
      continue
    }

    const next = segments[index + 1]
    if (next?.type === "text") {
      const { firstWord, rest } = splitLeadingWord(next.value)
      blocks.push({
        type: "verse",
        verse: segment.value,
        firstWord,
        rest,
      })
      index += 1
      continue
    }

    blocks.push({
      type: "verse",
      verse: segment.value,
      firstWord: "",
      rest: "",
    })
  }

  return blocks
}
