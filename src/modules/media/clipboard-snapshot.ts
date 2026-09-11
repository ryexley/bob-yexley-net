import {
  filesFromHtmlDataUrls,
  normalizeClipboardMediaFile,
} from "./file-validation"

export type ClipboardSnapshot = {
  files: File[]
  text: string
  /** True when the browser refused the read (iOS dismissed the Paste chip). */
  denied?: boolean
}

export function clipboardReadIsAvailable(): boolean {
  if (typeof navigator === "undefined") {
    return false
  }
  const clipboard = navigator.clipboard
  return (
    typeof clipboard?.read === "function" ||
    typeof clipboard?.readText === "function"
  )
}

export function clipboardSnapshotIsPasteable(
  snapshot: ClipboardSnapshot,
): boolean {
  return snapshot.files.length > 0 || snapshot.text.trim().length > 0
}

// WebKit's async clipboard API only documents image/png for images. GIFs
// copied from Photos usually arrive on the native paste event instead. Still
// try common media types; getType throws if that representation is absent.
const MEDIA_TYPES_TO_TRY = [
  "image/png",
  "image/gif",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
]

const isMediaMime = (mime: string): boolean =>
  mime.startsWith("image/") || mime.startsWith("video/")

export async function snapshotFromClipboardItems(
  items: ClipboardItem[],
): Promise<ClipboardSnapshot> {
  const files: File[] = []
  let text = ""

  for (const item of items) {
    const listed = Array.from(item.types ?? [])
    const candidates = [
      ...listed.filter(type => isMediaMime(type)),
      ...MEDIA_TYPES_TO_TRY,
    ]
    const tried = new Set<string>()
    let foundMedia = false

    for (const type of candidates) {
      if (tried.has(type)) {
        continue
      }
      tried.add(type)
      try {
        const blob = await item.getType(type)
        if (!blob || blob.size === 0) {
          continue
        }
        const mime = (blob.type || type).toLowerCase()
        if (!isMediaMime(mime)) {
          continue
        }
        files.push(
          normalizeClipboardMediaFile(
            new File([blob], "image", { type: mime }),
            mime,
          ),
        )
        foundMedia = true
        break
      } catch {
        // Representation is not on this item.
      }
    }

    if (foundMedia) {
      continue
    }

    if (listed.includes("text/html")) {
      try {
        const html = await (await item.getType("text/html")).text()
        const fromHtml = filesFromHtmlDataUrls(html)
        if (fromHtml.length > 0) {
          files.push(...fromHtml)
          continue
        }
      } catch {
        // Ignore missing HTML.
      }
    }

    if (!text && listed.includes("text/plain")) {
      try {
        text = await (await item.getType("text/plain")).text()
      } catch {
        // Ignore missing text.
      }
    }
  }

  return { files, text }
}

/**
 * Read the clipboard. Must be invoked synchronously from a click handler.
 *
 * Do not call this from pointerdown: on iOS, Safari shows a Paste callout
 * for other-app clipboard content, and the rest of that same tap dismisses
 * it, so the read looks like a no-op.
 *
 * A denied read is not "empty clipboard" — callers must not disable Paste.
 * We also do not fall through to `readText()` after `read()` is denied.
 */
export async function readClipboardSnapshot(): Promise<ClipboardSnapshot> {
  const clipboard = globalThis.navigator?.clipboard
  if (!clipboard) {
    return { files: [], text: "", denied: true }
  }

  if (typeof clipboard.read === "function") {
    try {
      return await snapshotFromClipboardItems(await clipboard.read())
    } catch {
      return { files: [], text: "", denied: true }
    }
  }

  if (typeof clipboard.readText === "function") {
    try {
      return { files: [], text: await clipboard.readText() }
    } catch {
      return { files: [], text: "", denied: true }
    }
  }

  return { files: [], text: "", denied: true }
}
