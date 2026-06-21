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

const extensionOf = (name: string): string | null => {
  const base = name.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) {
    return null
  }
  return `.${base.slice(dot + 1).toLowerCase()}`
}

const isAcceptedType = (file: File): boolean => {
  const mime = (file.type ?? "").toLowerCase().split(";")[0].trim()
  if (mime && ACCEPTED_MIME_TYPES.has(mime)) {
    return true
  }
  const ext = extensionOf(file.name ?? "")
  return ext != null && ACCEPTED_EXTENSIONS.has(ext)
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
