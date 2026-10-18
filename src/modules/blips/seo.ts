/**
 * SEO utilities for deriving titles and descriptions from blip content.
 */

import { findAudioEmbedRegions } from "@/components/markdown/audio/audio-embed-syntax"
import { findMediaEmbedRegions } from "@/components/markdown/media/media-embed-syntax"

function stripCustomEmbeds(content: string): string {
  const regions = [
    ...findMediaEmbedRegions(content),
    ...findAudioEmbedRegions(content),
  ].sort((a, b) => a.start - b.start)

  if (regions.length === 0) {
    return content
  }

  let result = ""
  let lastEnd = 0
  for (const region of regions) {
    if (region.start < lastEnd) {
      continue
    }
    result += content.slice(lastEnd, region.start)
    lastEnd = region.end
  }
  result += content.slice(lastEnd)
  return result
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[*-+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_=~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function truncateAtWord(
  text: string,
  maxLength: number,
  minBoundary: number,
  ellipsis = "",
): string {
  if (text.length <= maxLength) {
    return text
  }

  const truncated = text.slice(0, maxLength).trimEnd()
  const lastSpace = truncated.lastIndexOf(" ")
  const clipped =
    lastSpace > minBoundary ? truncated.slice(0, lastSpace) : truncated
  return clipped + ellipsis
}

/**
 * Derive a title from blip content.
 *
 * Priority:
 * 1. First markdown heading (h1-h6)
 * 2. First sentence of plain text, truncated to maxLength at word boundary
 *
 * Custom `{media:{...}}` / `{audio:{...}}` embeds are ignored so a leading
 * image does not become the share-link / Open Graph title.
 *
 * @param content - Raw markdown content
 * @param maxLength - Maximum length for truncated title (default 60)
 * @returns Derived title string
 */
export function deriveBlipTitle(content: string, maxLength = 60): string {
  const withoutEmbeds = stripCustomEmbeds(content)
  const headingMatch = withoutEmbeds.match(/^#{1,6}\s+(.+)$/m)
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim()
  }

  const plainText = stripMarkdown(withoutEmbeds)
  const firstSentence = plainText.split(/[.!?]/)[0]?.trim() || plainText
  return truncateAtWord(firstSentence, maxLength, 30)
}

/**
 * Resolve the public title for a blip: the stored title when set, otherwise
 * the title derived from content. Used for share-link / Open Graph text.
 */
export function resolveBlipTitle(
  blip: { title?: string | null; content?: string | null } | null | undefined,
  maxLength = 60,
): string {
  const stored = blip?.title?.trim()
  if (stored) {
    return stored
  }
  return deriveBlipTitle(blip?.content ?? "", maxLength)
}

/**
 * Derive a description from blip content.
 *
 * Extracts body text excluding the first heading, strips markdown,
 * and truncates to maxLength at a word boundary.
 *
 * @param content - Raw markdown content
 * @param maxLength - Maximum length for description (default 155)
 * @returns Derived description with ellipsis if truncated
 */
export function deriveBlipDescription(
  content: string,
  maxLength = 155,
): string {
  const withoutEmbeds = stripCustomEmbeds(content)
  const withoutHeading = withoutEmbeds.replace(/^#{1,6}\s+.+$/m, "").trim()
  const plainText = stripMarkdown(withoutHeading)
  return truncateAtWord(plainText, maxLength, 40, "...")
}

export const SITE_TITLE = "bob.yexley.net"
export const HOMEPAGE_TITLE = "Bob Yexley · Software engineer"
export const HOMEPAGE_DESCRIPTION =
  "The personal website of Bob Yexley, software engineer, with blips: short posts, notes and updates."
export const BLIPS_TITLE = "Blips · Bob Yexley"
export const BLIPS_DESCRIPTION = "Moments, thoughts and updates from Bob Yexley"

export function formatPageTitle(pageTitle: string): string {
  return `${pageTitle} · Bob Yexley`
}

export function formatTagTitle(tag: string): string {
  return `Blips tagged "${tag}" · Bob Yexley`
}

export function formatTagDescription(tag: string): string {
  return `View all blips tagged with "${tag}"`
}
