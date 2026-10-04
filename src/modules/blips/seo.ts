/**
 * SEO utilities for deriving titles and descriptions from blip content.
 */

/**
 * Derive a title from blip content.
 * 
 * Priority:
 * 1. First markdown heading (h1-h6)
 * 2. First sentence of plain text, truncated to maxLength at word boundary
 * 
 * @param content - Raw markdown content
 * @param maxLength - Maximum length for truncated title (default 60)
 * @returns Derived title string
 */
export function deriveBlipTitle(content: string, maxLength = 60): string {
  const headingMatch = content.match(/^#{1,6}\s+(.+)$/m)
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim()
  }

  const plainText = content
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

  const firstSentence = plainText.split(/[.!?]/)[0]?.trim() || plainText
  if (firstSentence.length <= maxLength) {
    return firstSentence
  }

  const truncated = firstSentence.slice(0, maxLength).trimEnd()
  const lastSpace = truncated.lastIndexOf(" ")
  return lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated
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
export function deriveBlipDescription(content: string, maxLength = 155): string {
  const withoutHeading = content.replace(/^#{1,6}\s+.+$/m, "").trim()
  
  const plainText = withoutHeading
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

  if (plainText.length <= maxLength) {
    return plainText
  }

  const truncated = plainText.slice(0, maxLength).trimEnd()
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + "..."
}

export const SITE_TITLE = "bob.yexley.net"
export const HOMEPAGE_TITLE = "Bob Yexley · Software engineer"
export const HOMEPAGE_DESCRIPTION = "The personal website of Bob Yexley, software engineer, with blips: short posts, notes and updates."
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
