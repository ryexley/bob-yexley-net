/**
 * Composer-side pre-validation (spec §5.2: "invalid files rejected with inline
 * error"). `uploadStore` silently drops files that fail Uppy's restrictions, so
 * the composer validates first and surfaces feedback before calling `attach`.
 *
 * Mirrors `uploadStore`'s own restrictions (accepted types + 150MB ceiling) using
 * the shared `ALLOWED_FILE_TYPES`/`MAX_FILE_SIZE_BYTES` so the two never drift.
 */
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from "./upload-store"

export type RejectedFile = {
  file: File
  reason: "type" | "size"
}

export type MediaValidationResult = {
  accepted: File[]
  rejected: RejectedFile[]
}

const ACCEPTED_MIME_TYPES = new Set(
  ALLOWED_FILE_TYPES.filter(entry => !entry.startsWith(".")).map(entry =>
    entry.toLowerCase(),
  ),
)
const ACCEPTED_EXTENSIONS = new Set(
  ALLOWED_FILE_TYPES.filter(entry => entry.startsWith(".")).map(entry =>
    entry.toLowerCase(),
  ),
)

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heic",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
}

const extensionOf = (name: string): string | null => {
  const base = name.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) {
    return null
  }
  return `.${base.slice(dot + 1).toLowerCase()}`
}

const mimeOf = (value: string | undefined): string =>
  (value ?? "").toLowerCase().split(";")[0].trim()

const isAcceptedType = (file: File): boolean => {
  const mime = mimeOf(file.type)
  if (mime && ACCEPTED_MIME_TYPES.has(mime)) {
    return true
  }
  const ext = extensionOf(file.name ?? "")
  return ext != null && ACCEPTED_EXTENSIONS.has(ext)
}

const isMediaMime = (mime: string): boolean =>
  mime.startsWith("image/") || mime.startsWith("video/")

/** Clipboard/OS paste items that can become blip media (images, GIFs, video). */
export const isClipboardMediaFile = (
  file: File,
  mimeHint?: string,
): boolean => {
  const mime = mimeOf(file.type) || mimeOf(mimeHint)
  if (isMediaMime(mime)) {
    return true
  }
  const ext = extensionOf(file.name ?? "")
  if (ext && EXT_TO_MIME[ext]) {
    return true
  }
  const name = (file.name ?? "").toLowerCase()
  return /^image\.(png|jpe?g|gif|webp|heic|heif)$/.test(name)
}

export const normalizeClipboardMediaFile = (
  file: File,
  mimeHint?: string,
): File => {
  const mime =
    mimeOf(file.type) ||
    mimeOf(mimeHint) ||
    EXT_TO_MIME[extensionOf(file.name ?? "") ?? ""] ||
    "image/png"
  const name = file.name?.trim() ? file.name : clipboardFilename(mime)
  if (file.type === mime && file.name === name) {
    return file
  }
  return new File([file], name, { type: mime, lastModified: file.lastModified })
}

const DATA_URL_IMAGE =
  /src=["'](data:(image\/[a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/]+=*)["']/gi

/** Images inlined as data URLs in clipboard HTML (Safari often omits image/*). */
export const filesFromHtmlDataUrls = (html: string): File[] => {
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

const clipboardFilename = (mime: string): string => {
  if (mime === "image/jpeg") {
    return "image.jpg"
  }
  if (mime === "image/heic" || mime === "image/heif") {
    return "image.heic"
  }
  if (mime === "video/quicktime") {
    return "video.mov"
  }
  const subtype = mime.split("/")[1] || "png"
  return mime.startsWith("video/") ? `video.${subtype}` : `image.${subtype}`
}

/**
 * Files from a paste `DataTransfer`. Prefers `files`; iOS often only exposes
 * a screenshot on `items`, sometimes with an empty `type`.
 */
export const clipboardMediaFiles = (
  data: DataTransfer | null | undefined,
): File[] => {
  if (!data) {
    return []
  }

  const collected: File[] = []
  const seen = new Set<File>()
  const seenKeys = new Set<string>()

  const take = (file: File | null | undefined, mimeHint?: string) => {
    if (!file || seen.has(file) || !isClipboardMediaFile(file, mimeHint)) {
      return
    }
    seen.add(file)
    const next = normalizeClipboardMediaFile(file, mimeHint)
    const key = `${next.name}:${next.size}:${next.type}`
    if (seenKeys.has(key)) {
      return
    }
    seenKeys.add(key)
    collected.push(next)
  }

  for (const file of Array.from(data.files ?? [])) {
    take(file)
  }

  for (const item of Array.from(data.items ?? [])) {
    const type = mimeOf(item.type)
    if (item.kind !== "file" && !isMediaMime(type)) {
      continue
    }
    take(item.getAsFile(), type)
  }

  return collected
}

export function clipboardLooksLikeMedia(
  data: DataTransfer | null | undefined,
): boolean {
  if (!data) {
    return false
  }
  if (clipboardMediaFiles(data).length > 0) {
    return true
  }

  const types = Array.from(data.types ?? [])
  if (
    types.includes("Files") ||
    types.some(type => isMediaMime(mimeOf(type)))
  ) {
    return true
  }

  for (const item of Array.from(data.items ?? [])) {
    const type = mimeOf(item.type)
    if (item.kind === "file" || isMediaMime(type)) {
      return true
    }
  }

  return false
}

/** Partition files into those that pass `uploadStore`'s restrictions and those that don't. */
export function validateMediaFiles(files: File[]): MediaValidationResult {
  const accepted: File[] = []
  const rejected: RejectedFile[] = []

  for (const file of files) {
    if (!isAcceptedType(file)) {
      rejected.push({ file, reason: "type" })
      continue
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejected.push({ file, reason: "size" })
      continue
    }
    accepted.push(file)
  }

  return { accepted, rejected }
}
