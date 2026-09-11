import type { AttachedUpload } from "./upload-store"
import {
  clipboardLooksLikeMedia,
  clipboardMediaFiles,
  filesFromHtmlDataUrls,
  validateMediaFiles,
  type MediaValidationResult,
} from "./file-validation"
import { MEDIA_PLACEMENT, type MediaPlacement } from "./placement"
import { snapshotFromClipboardItems } from "./clipboard-snapshot"

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

function markPasteHandled(event: ClipboardEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation?.()
}

export async function readClipboardMediaFiles(
  data: DataTransfer | null | undefined,
): Promise<File[]> {
  const sync = clipboardMediaFiles(data)
  if (sync.length > 0) {
    return sync
  }

  const html =
    typeof data?.getData === "function" ? data.getData("text/html") : ""
  const fromHtml = filesFromHtmlDataUrls(html)
  if (fromHtml.length > 0) {
    return fromHtml
  }

  const clipboard = globalThis.navigator?.clipboard
  if (typeof clipboard?.read !== "function") {
    return []
  }

  try {
    const snapshot = await snapshotFromClipboardItems(await clipboard.read())
    return snapshot.files
  } catch {
    return []
  }
}

/**
 * Consume a paste when it carries media. Returns true when the default insert
 * should not run (ProseMirror would otherwise paste a transient blob image).
 */
export function consumeClipboardMediaPaste(
  event: ClipboardEvent,
  onMedia: (result: MediaValidationResult) => void,
): boolean {
  const inspected = inspectClipboardMediaPaste(event.clipboardData)
  if (inspected) {
    markPasteHandled(event)
    onMedia(inspected)
    return true
  }

  if (!clipboardLooksLikeMedia(event.clipboardData)) {
    return false
  }

  markPasteHandled(event)
  void readClipboardMediaFiles(event.clipboardData).then(files => {
    if (files.length === 0) {
      return
    }
    onMedia(validateMediaFiles(files))
  })
  return true
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
