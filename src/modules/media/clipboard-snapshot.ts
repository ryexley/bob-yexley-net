import { normalizeClipboardMediaFile } from "./file-validation"

export type ClipboardSnapshot = {
  files: File[]
  text: string
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
 * Read whatever the clipboard will give us. Must run in a user gesture on
 * iOS/Safari — probing in the background is denied, so callers treat a thrown
 * permission error as "unknown" rather than empty.
 */
export async function readClipboardSnapshot(): Promise<ClipboardSnapshot> {
  const clipboard = globalThis.navigator?.clipboard
  if (!clipboard) {
    return { files: [], text: "" }
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
      // Permission denied or unsupported — try the text-only path.
    }
  }

  if (typeof clipboard.readText === "function") {
    try {
      return { files: [], text: await clipboard.readText() }
    } catch {
      return { files: [], text: "" }
    }
  }

  return { files: [], text: "" }
}
