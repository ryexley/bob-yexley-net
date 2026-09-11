import type { MediaType } from "@/modules/media/filename"

type MediaEmbedBlock = {
  raw: string
  objectLiteral: string
}

export type MediaEmbedSize = "25" | "50" | "100"
export type MediaEmbedAlign = "left" | "center" | "right"

export const MEDIA_EMBED_SIZE_DEFAULT: MediaEmbedSize = "100"
export const MEDIA_EMBED_ALIGN_DEFAULT: MediaEmbedAlign = "left"

export const MEDIA_EMBED_LIGHTBOX_DEFAULT = false
export const MEDIA_EMBED_NODE = "media_embed"

export type MediaEmbedProps = {
  key: string
  type: MediaType
  mime?: string
  size?: MediaEmbedSize
  align?: MediaEmbedAlign
  lightbox?: boolean
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

function readMediaEmbedBlock(source: string): {
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
  if (!matchKeyword(source, index, "media")) {
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

export function readLeadingMediaEmbedBlock(
  source: string,
): MediaEmbedBlock | null {
  const leadingWhitespace = source.match(/^\s*/)?.[0] ?? ""
  const rest = source.slice(leadingWhitespace.length)
  const block = readMediaEmbedBlock(rest)
  if (!block) {
    return null
  }
  return {
    raw: leadingWhitespace + block.raw,
    objectLiteral: block.objectLiteral,
  }
}

export function extractMediaEmbedBlock(source: string): MediaEmbedBlock | null {
  const block = readLeadingMediaEmbedBlock(source)
  if (!block) {
    return null
  }
  const trailing = source.slice(block.raw.length)
  if (trailing.trim().length > 0) {
    return null
  }
  return block
}

function minifyJsObjectLiteral(source: string): string {
  let result = ""
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '"' || char === "'") {
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

function propsFromObjectLiteral(objectLiteral: string): MediaEmbedProps | null {
  return coerceMediaEmbedProps(
    parseMediaEmbedObjectLiteral(objectLiteral) ?? {},
  )
}

export function canonicalizeMediaEmbedBlock(block: MediaEmbedBlock): string {
  const props = propsFromObjectLiteral(block.objectLiteral)
  if (!props) {
    return `{media:${minifyJsObjectLiteral(block.objectLiteral)}}`
  }
  return canonicalizeMediaEmbed(props)
}

export function canonicalizeMediaEmbed(embed: MediaEmbedProps): string {
  const mime = embed.mime ? `,mime:${JSON.stringify(embed.mime)}` : ""
  const size =
    embed.size && embed.size !== MEDIA_EMBED_SIZE_DEFAULT
      ? `,size:${JSON.stringify(embed.size)}`
      : ""
  const align =
    embed.align && embed.align !== MEDIA_EMBED_ALIGN_DEFAULT
      ? `,align:${JSON.stringify(embed.align)}`
      : ""
  const lightbox = embed.lightbox ? ",lightbox:true" : ""
  return `{media:{key:${JSON.stringify(embed.key)},type:${JSON.stringify(embed.type)}${mime}${size}${align}${lightbox}}}`
}

export function findMediaEmbedRegions(content: string) {
  const regions: Array<{
    start: number
    end: number
    block: MediaEmbedBlock
  }> = []

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "{") {
      continue
    }
    const block = readMediaEmbedBlock(content.slice(index))
    if (!block) {
      continue
    }
    const props = propsFromObjectLiteral(block.objectLiteral)
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

export function normalizeMediaEmbedsInMarkdown(content: string): string {
  const regions = findMediaEmbedRegions(content)
  if (regions.length === 0) {
    return content
  }
  let normalized = ""
  let lastEnd = 0
  for (const region of regions) {
    normalized += content.slice(lastEnd, region.start)
    normalized += canonicalizeMediaEmbedBlock(region.block)
    lastEnd = region.end
  }
  normalized += content.slice(lastEnd)
  return normalized.replace(/^(?:\r?\n)+(?=\{\s*media\s*:)/, "")
}

export function parseMediaEmbedObjectLiteral(
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

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const MEDIA_TYPES = new Set<MediaType>(["image", "video", "gif"])
const MEDIA_SIZES = new Set<MediaEmbedSize>(["25", "50", "100"])
const MEDIA_ALIGNS = new Set<MediaEmbedAlign>(["left", "center", "right"])

export function parseMediaEmbedSize(value: unknown): MediaEmbedSize {
  const asString =
    typeof value === "number" ? String(value) : readOptionalString(value)
  return asString && MEDIA_SIZES.has(asString as MediaEmbedSize)
    ? (asString as MediaEmbedSize)
    : MEDIA_EMBED_SIZE_DEFAULT
}

export function parseMediaEmbedAlign(value: unknown): MediaEmbedAlign {
  const asString = readOptionalString(value)
  return asString && MEDIA_ALIGNS.has(asString as MediaEmbedAlign)
    ? (asString as MediaEmbedAlign)
    : MEDIA_EMBED_ALIGN_DEFAULT
}

export function parseMediaEmbedLightbox(value: unknown): boolean {
  if (value === true || value === 1) {
    return true
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase()
    return trimmed === "true" || trimmed === "1"
  }
  return MEDIA_EMBED_LIGHTBOX_DEFAULT
}

export function coerceMediaEmbedProps(
  raw: Record<string, unknown>,
): MediaEmbedProps | null {
  const key = readOptionalString(raw.key)
  const type = (readOptionalString(raw.type) ??
    readOptionalString(raw.mediaType)) as MediaType | undefined
  if (!key || !type || !MEDIA_TYPES.has(type)) {
    return null
  }
  const mime = readOptionalString(raw.mime) ?? readOptionalString(raw.mimeType)
  const size = parseMediaEmbedSize(raw.size)
  const align = parseMediaEmbedAlign(raw.align)
  const lightbox = parseMediaEmbedLightbox(raw.lightbox)
  const props: MediaEmbedProps = { key, type }
  if (mime) {
    props.mime = mime
  }
  if (size !== MEDIA_EMBED_SIZE_DEFAULT) {
    props.size = size
  }
  if (align !== MEDIA_EMBED_ALIGN_DEFAULT) {
    props.align = align
  }
  if (lightbox) {
    props.lightbox = true
  }
  return props
}

export type MediaEmbedEditorAttrs = {
  key: string
  mediaType: string
  mimeType: string
  size: MediaEmbedSize
  align: MediaEmbedAlign
  lightbox: boolean
}

export const MEDIA_EMBED_EDITOR_ATTR_DEFAULTS: MediaEmbedEditorAttrs = {
  key: "",
  mediaType: "image",
  mimeType: "",
  size: MEDIA_EMBED_SIZE_DEFAULT,
  align: MEDIA_EMBED_ALIGN_DEFAULT,
  lightbox: MEDIA_EMBED_LIGHTBOX_DEFAULT,
}

export function mediaEmbedPropsToAttrs(
  embed: MediaEmbedProps,
): MediaEmbedEditorAttrs {
  return {
    key: embed.key,
    mediaType: embed.type,
    mimeType: embed.mime ?? "",
    size: embed.size ?? MEDIA_EMBED_SIZE_DEFAULT,
    align: embed.align ?? MEDIA_EMBED_ALIGN_DEFAULT,
    lightbox: embed.lightbox ?? MEDIA_EMBED_LIGHTBOX_DEFAULT,
  }
}

export function mediaEmbedEditorAttrsFromUnknown(
  raw: Record<string, unknown>,
): MediaEmbedEditorAttrs {
  return {
    key: typeof raw.key === "string" ? raw.key : String(raw.key ?? ""),
    mediaType:
      readOptionalString(raw.mediaType) ??
      readOptionalString(raw.type) ??
      MEDIA_EMBED_EDITOR_ATTR_DEFAULTS.mediaType,
    mimeType:
      readOptionalString(raw.mimeType) ?? readOptionalString(raw.mime) ?? "",
    size: parseMediaEmbedSize(raw.size),
    align: parseMediaEmbedAlign(raw.align),
    lightbox: parseMediaEmbedLightbox(raw.lightbox),
  }
}

export function mediaEmbedDataAttributes(
  attrs: MediaEmbedEditorAttrs,
): Record<string, string> {
  const data: Record<string, string> = {
    "data-media-embed": "",
    "data-media-key": attrs.key,
    "data-media-type": attrs.mediaType,
    "data-media-mime": attrs.mimeType,
    "data-media-size": attrs.size,
    "data-media-align": attrs.align,
  }
  if (attrs.lightbox) {
    data["data-media-lightbox"] = "true"
  }
  return data
}

export function mediaEmbedEditorAttrsFromElement(element: {
  getAttribute(name: string): string | null
}): MediaEmbedEditorAttrs {
  return mediaEmbedEditorAttrsFromUnknown({
    key: element.getAttribute("data-media-key") ?? "",
    type: element.getAttribute("data-media-type"),
    mime: element.getAttribute("data-media-mime"),
    size: element.getAttribute("data-media-size"),
    align: element.getAttribute("data-media-align"),
    lightbox: element.getAttribute("data-media-lightbox"),
  })
}

export function parseLeadingMediaEmbed(
  source: string,
): { raw: string; props: MediaEmbedProps } | null {
  const block = readLeadingMediaEmbedBlock(source)
  if (!block) {
    return null
  }
  const props = propsFromObjectLiteral(block.objectLiteral)
  if (!props) {
    return null
  }
  return { raw: block.raw, props }
}

export function parseMediaEmbedBlock(source: string): MediaEmbedProps | null {
  const parsed = parseLeadingMediaEmbed(source)
  if (!parsed || source.slice(parsed.raw.length).trim().length > 0) {
    return null
  }
  return parsed.props
}

export function parseMediaEmbedEditorAttrs(
  value: string,
): MediaEmbedEditorAttrs | null {
  const props = parseMediaEmbedBlock(value)
  return props ? mediaEmbedPropsToAttrs(props) : null
}
