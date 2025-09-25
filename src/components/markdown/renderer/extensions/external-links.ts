import { type Tokens } from "marked"
import type { RendererExtension } from "./types"

const INTERNAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "bob.yexley.net",
  "www.bob.yexley.net",
])

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

const isExternalHref = (href: string) => {
  const value = href.trim()
  if (!value) {
    return false
  }

  if (
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("?") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("sms:")
  ) {
    return false
  }

  try {
    const parsed = new URL(value, "http://localhost")
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false
    }

    if (
      !value.startsWith("http://") &&
      !value.startsWith("https://") &&
      !value.startsWith("//")
    ) {
      return false
    }

    if (typeof window !== "undefined") {
      return parsed.hostname !== window.location.hostname
    }

    return !INTERNAL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export const externalLinksExtension: RendererExtension = {
  extendRenderer(renderer) {
    renderer.link = function (token: Tokens.Link) {
      const href = token.href || ""
      const title = token.title || ""
      const text = this.parser.parseInline(token.tokens)
      const targetAttrs = isExternalHref(href)
        ? ' target="_blank" rel="noopener noreferrer"'
        : ""
      const titleAttr = title ? ` title="${escapeAttribute(title)}"` : ""

      return `<a href="${escapeAttribute(href)}"${titleAttr}${targetAttrs}>${text}</a>`
    }
  },
}
