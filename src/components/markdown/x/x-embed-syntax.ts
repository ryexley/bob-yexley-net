export const X_EMBED_NODE = "x_embed"

export type XEmbedProps = {
  url: string
  id: string
  handle?: string
}

type XEmbedBlock = {
  raw: string
  objectLiteral: string
}

const X_STATUS_URL =
  /^(?:https?:\/\/)?(?:www\.)?(?:mobile\.)?(?:twitter|x)\.com\/(?:([A-Za-z0-9_]{1,15})\/status(?:es)?\/|i\/web\/status\/)(\d+)(?:\/(?:photo|video)\/\d+)?(?:[/?#].*)?$/i

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

function readBalancedObject(
  source: string,
  openBraceIndex: number,
): number | null {
  if (source[openBraceIndex] !== "{") {
    return null
  }
  let depth = 0
  let index = openBraceIndex
  while (index < source.length) {
    const char = source[index]
    if (char === '"' || char === "'") {
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

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function unwrapCopiedUrl(input: string): string {
  return input.trim().replace(/^<|>$/g, "").trim()
}

/** Parse a copied X/Twitter status URL into a canonical embed. */
export function parseXStatusUrl(input: string): XEmbedProps | null {
  const trimmed = unwrapCopiedUrl(input)
  if (!trimmed || /\s/.test(trimmed)) {
    return null
  }

  const match = trimmed.match(X_STATUS_URL)
  if (!match?.[2]) {
    return null
  }

  const handle = match[1] || undefined
  const id = match[2]
  return {
    id,
    handle,
    url: handle
      ? `https://x.com/${handle}/status/${id}`
      : `https://x.com/i/web/status/${id}`,
  }
}

export function coerceXEmbedProps(
  raw: Record<string, unknown>,
): XEmbedProps | null {
  const fromUrl = readOptionalString(raw.url)
  if (fromUrl) {
    const parsed = parseXStatusUrl(fromUrl)
    if (parsed) {
      return parsed
    }
  }

  const id = readOptionalString(raw.id)
  if (!id || !/^\d+$/.test(id)) {
    return null
  }

  const handle = readOptionalString(raw.handle)
  return {
    id,
    handle,
    url: handle
      ? `https://x.com/${handle}/status/${id}`
      : `https://x.com/i/web/status/${id}`,
  }
}

export function canonicalizeXEmbed(embed: XEmbedProps): string {
  return `{x:{url:${JSON.stringify(embed.url)}}}`
}

function parseXEmbedObjectLiteral(
  objectLiteral: string,
): Record<string, unknown> | null {
  const trimmed = objectLiteral.trim()
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null
  }
  try {
    const value = new Function(`"use strict"; return (${trimmed});`)()
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function readXEmbedBlock(source: string): {
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
  if (!matchKeyword(source, index, "x")) {
    return null
  }
  index += 1
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

export function readLeadingXEmbedBlock(source: string): XEmbedBlock | null {
  const leadingWhitespace = source.match(/^\s*/)?.[0] ?? ""
  const rest = source.slice(leadingWhitespace.length)
  const block = readXEmbedBlock(rest)
  if (!block) {
    return null
  }
  return {
    raw: leadingWhitespace + block.raw,
    objectLiteral: block.objectLiteral,
  }
}

export function parseLeadingXEmbed(
  source: string,
): { raw: string; props: XEmbedProps } | null {
  const block = readLeadingXEmbedBlock(source)
  if (!block) {
    return null
  }
  const props = coerceXEmbedProps(
    parseXEmbedObjectLiteral(block.objectLiteral) ?? {},
  )
  if (!props) {
    return null
  }
  return { raw: block.raw, props }
}

export function parseXEmbedBlock(source: string): XEmbedProps | null {
  const parsed = parseLeadingXEmbed(source)
  if (!parsed || source.slice(parsed.raw.length).trim().length > 0) {
    return null
  }
  return parsed.props
}

const LEADING_STATUS_URL = /^((?:[ \t]*\n)*[ \t]*)(\S+)([ \t]*(?:\n|$))/

/** A standalone X status URL occupying the start of a markdown block. */
export function parseLeadingXStatusUrl(
  source: string,
): { raw: string; props: XEmbedProps } | null {
  const match = source.match(LEADING_STATUS_URL)
  if (!match?.[2]) {
    return null
  }
  const props = parseXStatusUrl(match[2])
  if (!props) {
    return null
  }
  return { raw: match[0], props }
}

export function findXEmbedRegions(content: string) {
  const regions: Array<{
    start: number
    end: number
    block: XEmbedBlock
  }> = []

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "{") {
      continue
    }
    const block = readXEmbedBlock(content.slice(index))
    if (!block) {
      continue
    }
    const props = coerceXEmbedProps(
      parseXEmbedObjectLiteral(block.objectLiteral) ?? {},
    )
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

export function xEmbedEditorAttrsFromUnknown(
  raw: Record<string, unknown>,
): XEmbedProps {
  return (
    coerceXEmbedProps(raw) ?? {
      url: "",
      id: "",
    }
  )
}

export function parseXEmbedEditorAttrs(value: string): XEmbedProps | null {
  return parseXEmbedBlock(value) ?? parseXStatusUrl(value.trim())
}

/**
 * Same job as `normalizeMediaEmbedsInMarkdown`: stored embed markdown can
 * start with a leftover `<br />` or blank line from an older save. Drop
 * that prefix so the published page matches what the editor now writes.
 */
export function normalizeXEmbedsInMarkdown(content: string): string {
  return content
    .replace(/^(?:<br\s*\/?>\s*)+/i, "")
    .replace(/^(?:\r?\n)+(?=\{\s*x\s*:)/, "")
    .replace(
      /^(?:\r?\n)+(?=https?:\/\/(?:www\.)?(?:mobile\.)?(?:twitter|x)\.com\/)/i,
      "",
    )
}

export function xEmbedDataAttributes(embed: XEmbedProps) {
  const attrs: Record<string, string> = {
    "data-x-embed": "",
    "data-x-url": embed.url,
    "data-x-status-id": embed.id,
  }
  if (embed.handle) {
    attrs["data-x-handle"] = embed.handle
  }
  return attrs
}
