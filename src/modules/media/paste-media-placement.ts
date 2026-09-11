import type { AttachedUpload } from "./upload-store"
import {
  clipboardLooksLikeMedia,
  clipboardMediaFiles,
  normalizeClipboardMediaFile,
  validateMediaFiles,
  type MediaValidationResult,
} from "./file-validation"
import { MEDIA_PLACEMENT, type MediaPlacement } from "./placement"

const DATA_URL_IMAGE =
  /src=["'](data:(image\/[a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/]+=*)["']/gi

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

function filesFromHtmlDataUrls(html: string): File[] {
  if (!html) {
    return []
  }
  const files: File[] = []
  for (const match of html.matchAll(DATA_URL_IMAGE)) {
    const dataUrl = match[1]
    const mime = match[2]
    if (!dataUrl || !mime) {
      continue
    }
    const comma = dataUrl.indexOf(",")
    if (comma < 0) {
      continue
    }
    try {
      const binary = atob(dataUrl.slice(comma + 1))
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      files.push(
        normalizeClipboardMediaFile(
          new File([bytes], "image", { type: mime }),
          mime,
        ),
      )
    } catch {
      // Ignore malformed data URLs.
    }
  }
  return files
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
    const items = await clipboard.read()
    const files: File[] = []
    for (const item of items) {
      const type = item.types.find(
        candidate =>
          candidate.startsWith("image/") || candidate.startsWith("video/"),
      )
      if (!type) {
        continue
      }
      const blob = await item.getType(type)
      files.push(
        normalizeClipboardMediaFile(new File([blob], "image", { type }), type),
      )
    }
    return files
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
