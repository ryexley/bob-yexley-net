import type { AudioPlayerProps } from "@/components/audio-player"

type AudioEmbedBlock = {
  raw: string
  objectLiteral: string
}

function skipWhitespace(source: string, index: number): number {
  while (index < source.length && /\s/.test(source[index] ?? "")) {
    index += 1
  }

  return index
}

function matchKeyword(source: string, index: number, keyword: string): boolean {
  if (!source.startsWith(keyword, index)) {
    return false
  }

  const next = source[index + keyword.length]
  return next === undefined || !/[a-zA-Z0-9_$]/.test(next)
}

function skipQuotedString(source: string, start: number): number {
  const quote = source[start]
  let index = start + 1

  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2
      continue
    }

    if (source[index] === quote) {
      return index + 1
    }

    index += 1
  }

  return source.length
}

function readBalancedObject(source: string, openBraceIndex: number): number | null {
  if (source[openBraceIndex] !== "{") {
    return null
  }

  let depth = 0
  let index = openBraceIndex

  while (index < source.length) {
    const char = source[index]

    if (char === "\"" || char === "'") {
      index = skipQuotedString(source, index)
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return index + 1
      }
    }

    index += 1
  }

  return null
}

export function extractAudioEmbedBlock(source: string): AudioEmbedBlock | null {
  const leadingWhitespace = source.match(/^\s*/)?.[0] ?? ""
  const rest = source.slice(leadingWhitespace.length)
  const block = readAudioEmbedBlock(rest)
  if (!block) {
    return null
  }

  const trailing = rest.slice(block.endIndex)
  if (trailing.trim().length > 0) {
    return null
  }

  return {
    raw: leadingWhitespace + block.raw,
    objectLiteral: block.objectLiteral,
  }
}

function readAudioEmbedBlock(source: string): {
  raw: string
  objectLiteral: string
  endIndex: number
} | null {
  let index = 0
  const start = index

  if (source[index] !== "{") {
    return null
  }

  index += 1
  index = skipWhitespace(source, index)

  if (!matchKeyword(source, index, "audio")) {
    return null
  }

  index += 5
  index = skipWhitespace(source, index)

  if (source[index] !== ":") {
    return null
  }

  index += 1
  index = skipWhitespace(source, index)

  if (source[index] !== "{") {
    return null
  }

  const objectOpenIndex = index
  const objectEndIndex = readBalancedObject(source, objectOpenIndex)
  if (objectEndIndex === null) {
    return null
  }

  index = objectEndIndex
  index = skipWhitespace(source, index)

  if (source[index] !== "}") {
    return null
  }

  index += 1

  return {
    raw: source.slice(start, index),
    objectLiteral: source.slice(objectOpenIndex, objectEndIndex),
    endIndex: index,
  }
}

export function canonicalizeAudioEmbedBlock(block: AudioEmbedBlock): string {
  return `{audio:${minifyJsObjectLiteral(block.objectLiteral)}}`
}

function minifyJsObjectLiteral(source: string): string {
  let result = ""
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (char === "\"" || char === "'") {
      const end = skipQuotedString(source, index)
      result += source.slice(index, end)
      index = end
      continue
    }

    if (/\s/.test(char ?? "")) {
      index += 1
      continue
    }

    result += char
    index += 1
  }

  return result
}

export function findAudioEmbedRegions(content: string) {
  const regions: Array<{
    start: number
    end: number
    block: AudioEmbedBlock
  }> = []

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "{") {
      continue
    }

    const block = readAudioEmbedBlock(content.slice(index))
    if (!block) {
      continue
    }

    const props = parseAudioEmbedObjectLiteral(block.objectLiteral)
    if (!props) {
      continue
    }

    const start = index
    const end = index + block.endIndex
    const overlaps = regions.some(
      region => start < region.end && end > region.start,
    )
    if (overlaps) {
      continue
    }

    regions.push({
      start,
      end,
      block: {
        raw: block.raw,
        objectLiteral: block.objectLiteral,
      },
    })
  }

  return regions
}

export function normalizeAudioEmbedsInMarkdown(content: string): string {
  const regions = findAudioEmbedRegions(content)
  if (regions.length === 0) {
    return content
  }

  let normalized = ""
  let lastEnd = 0

  for (const region of regions) {
    normalized += content.slice(lastEnd, region.start)
    normalized += canonicalizeAudioEmbedBlock(region.block)
    lastEnd = region.end
  }

  normalized += content.slice(lastEnd)
  return normalized
}

export function parseAudioEmbedObjectLiteral(
  objectLiteral: string,
): Record<string, unknown> | null {
  const trimmed = objectLiteral.trim()
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null
  }

  try {
    // Author-authored blip content; JS object literals allow unquoted keys and single quotes.
    const value = new Function(`"use strict"; return (${trimmed});`)()
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null
    }

    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function readOptionalString(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }

  return value
}

export function coerceAudioPlayerProps(
  raw: Record<string, unknown>,
): AudioPlayerProps | null {
  const src = readOptionalString(raw.src)
  if (!src) {
    return null
  }

  const props: AudioPlayerProps = {
    src,
  }

  const storageKey = readOptionalString(raw.storageKey)
  if (storageKey) {
    props.storageKey = storageKey
  }

  const coverImage = readOptionalString(raw.coverImage)
  if (coverImage) {
    props.coverImage = coverImage
  }

  const title = readOptionalString(raw.title)
  if (title) {
    props.title = title
  }

  const artist = readOptionalString(raw.artist)
  if (artist) {
    props.artist = artist
  }

  const album = readOptionalString(raw.album)
  if (album) {
    props.album = album
  }

  const series = readOptionalString(raw.series)
  if (series) {
    props.series = series
  }

  const className = readOptionalString(raw.class)
  if (className) {
    props.class = className
  }

  const scrubSeconds = readOptionalNumber(raw.scrubSeconds)
  if (scrubSeconds !== undefined) {
    props.scrubSeconds = scrubSeconds
  }

  const volume = readOptionalNumber(raw.volume)
  if (volume !== undefined) {
    props.volume = volume
  }

  return props
}

export function parseAudioEmbedBlock(
  source: string,
): AudioPlayerProps | null {
  const block = extractAudioEmbedBlock(source)
  if (!block) {
    return null
  }

  const objectLiteral = parseAudioEmbedObjectLiteral(block.objectLiteral)
  if (!objectLiteral) {
    return null
  }

  return coerceAudioPlayerProps(objectLiteral)
}
