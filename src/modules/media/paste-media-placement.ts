import type { AttachedUpload } from "./upload-store"
import {
  clipboardMediaFiles,
  validateMediaFiles,
  type MediaValidationResult,
} from "./file-validation"
import { MEDIA_PLACEMENT, type MediaPlacement } from "./placement"

/**
 * Inspect a paste event for media files. `null` means leave the paste alone
 * (no prompt, no preventDefault). A result means the composer should prevent
 * the default paste and, when `accepted` is non-empty, open the placement prompt.
 */
export function inspectClipboardMediaPaste(
  clipboardData: DataTransfer | null | undefined,
): MediaValidationResult | null {
  const files = clipboardMediaFiles(clipboardData)
  if (files.length === 0) {
    return null
  }
  return validateMediaFiles(files)
}

export async function applyPasteMediaPlacement(options: {
  placement: MediaPlacement
  files: File[]
  attach: (
    files: File[],
    attachOptions: { source: "clipboard"; placement: MediaPlacement },
  ) => Promise<AttachedUpload[]>
  insertMediaEmbeds?: (items: AttachedUpload[]) => void
}): Promise<void> {
  const added = await options.attach(options.files, {
    source: "clipboard",
    placement: options.placement,
  })
  if (options.placement === MEDIA_PLACEMENT.Inline && added.length > 0) {
    options.insertMediaEmbeds?.(added)
  }
}
