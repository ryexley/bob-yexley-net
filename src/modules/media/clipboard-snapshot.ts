import { normalizeClipboardMediaFile } from "./file-validation"

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
      const items = await clipboard.read()
      const files: File[] = []
      let text = ""
      for (const item of items) {
        const mediaType = item.types.find(
          candidate =>
            candidate.startsWith("image/") || candidate.startsWith("video/"),
        )
        if (mediaType) {
          const blob = await item.getType(mediaType)
          files.push(
            normalizeClipboardMediaFile(
              new File([blob], "image", { type: mediaType }),
              mediaType,
            ),
          )
          continue
        }
        if (!text && item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain")
          text = await blob.text()
        }
      }
      return { files, text }
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
