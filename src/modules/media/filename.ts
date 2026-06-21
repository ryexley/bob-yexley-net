/**
 * Pure filename / media-type derivation for the upload pipeline.
 *
 * Trust boundary / runtime:
 * - Client-safe and dependency-light (only `exifr`, which is pure JS). No Uppy,
 *   R2, or Supabase coupling, so it unit-tests in isolation and can be exercised
 *   by the standalone Node diagnostic script.
 *
 * Naming convention (spec §3.2 / §10.2), in priority order:
 *   1. Clipboard paste        -> `sc-yyyymmddhhmmss`      (current local time at paste)
 *   2. EXIF `DateTimeOriginal` -> `yyyymmddhhmmss`         (as-is from EXIF, no tz normalization)
 *   3. No EXIF / no clipboard  -> `{blipId}-{n}`           (incrementing within the blip)
 *   4. Collision within a blip -> append `-{k}` suffix
 *
 * The returned `name` is the bare filename component WITHOUT extension; callers
 * build the R2 key as `media/{userId}/{blipId}/{name}` and the uploaded original
 * object as `{baseKey}-original.{ext}` (spec §3.1 / §13.4).
 */
// `exifr` is a CommonJS module; under Vite SSR its named exports aren't
// statically analyzable, so import the default and read `.parse` off it.
import exifr from "exifr"

export type MediaType = "image" | "video" | "gif"

export type DerivedFilename = {
  /** Filename component without extension, e.g. `20240815143022`, `sc-...`, `{blipId}-1`. */
  name: string
  /** Lowercase extension without a leading dot, e.g. `jpg`. */
  ext: string
}

export type FileLike = {
  name?: string | null
  type?: string | null
}

/** Bytes accepted by `exifr` for metadata extraction. */
export type ExifInput = ArrayBuffer | Uint8Array | Blob

/** Canonical mime -> extension. Mirrors the accepted types in spec §2. */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "qt"])

/** Extract a sane lowercase extension from a filename, or null. */
function extensionFromName(name?: string | null): string | null {
  if (!name) {
    return null
  }
  const base = name.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) {
    return null
  }
  const ext = base.slice(dot + 1).toLowerCase()
  // Guard against query-ish junk; real extensions are short and alphanumeric.
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : null
}

/**
 * Resolve the file extension for the stored original.
 * Filename extension wins; falls back to the mime map; clipboard pastes with no
 * other signal default to `png` (spec §3.2); last resort is `bin`.
 */
export function extensionForFile(
  file: FileLike,
  opts: { isClipboard?: boolean } = {},
): string {
  const fromName = extensionFromName(file.name)
  if (fromName) {
    return fromName
  }

  const mime = (file.type ?? "").toLowerCase()
  if (mime && MIME_TO_EXT[mime]) {
    return MIME_TO_EXT[mime]
  }

  if (opts.isClipboard) {
    return "png"
  }

  return "bin"
}

/** Classify a file into the `blip_media.media_type` domain (`image|video|gif`). */
export function mediaTypeForFile(file: FileLike): MediaType {
  const mime = (file.type ?? "").toLowerCase()
  const ext = extensionFromName(file.name)

  if (mime === "image/gif" || ext === "gif") {
    return "gif"
  }
  if (mime.startsWith("video/") || (ext != null && VIDEO_EXTENSIONS.has(ext))) {
    return "video"
  }
  return "image"
}

/**
 * True when the file is an image whose `/api/media/process` variants should be
 * generated server-side (spec §5.2). Videos use client-side thumbnails and GIFs
 * are stored as-is, so neither is processed.
 */
export function shouldProcess(file: FileLike): boolean {
  return mediaTypeForFile(file) === "image"
}

const pad2 = (value: number): string => String(value).padStart(2, "0")

function formatTimestamp(date: Date, useUtc: boolean): string {
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear()
  const month = (useUtc ? date.getUTCMonth() : date.getMonth()) + 1
  const day = useUtc ? date.getUTCDate() : date.getDate()
  const hours = useUtc ? date.getUTCHours() : date.getHours()
  const minutes = useUtc ? date.getUTCMinutes() : date.getMinutes()
  const seconds = useUtc ? date.getUTCSeconds() : date.getSeconds()
  return (
    `${year}` +
    pad2(month) +
    pad2(day) +
    pad2(hours) +
    pad2(minutes) +
    pad2(seconds)
  )
}

/**
 * Format an EXIF capture time as `yyyymmddhhmmss`, "as-is" with no timezone
 * normalization (spec §3.2).
 *
 * `exifr` encodes an EXIF datetime that carries no offset into the Date's *UTC*
 * fields (e.g. `2024:08:15 14:30:22` -> a Date whose UTC time reads 14:30:22), so
 * the UTC getters — not the local ones — reproduce the original EXIF digits
 * regardless of the machine's timezone.
 */
export function formatExifTimestamp(date: Date): string {
  return formatTimestamp(date, true)
}

/**
 * Format a local wall-clock time as `yyyymmddhhmmss`. Used for clipboard pastes,
 * whose name reflects the current *local* time at the moment of paste (spec §3.2).
 */
export function formatClipboardTimestamp(date: Date): string {
  return formatTimestamp(date, false)
}

/**
 * Read an EXIF capture timestamp from image bytes, or null if absent/unreadable.
 * Prefers `DateTimeOriginal`, falling back to `CreateDate`/`DateTimeDigitized`.
 * Never throws — non-images and metadata-less files simply yield null.
 */
export async function readExifTimestamp(
  input: ExifInput,
): Promise<Date | null> {
  try {
    const tags = (await exifr.parse(input as Parameters<typeof exifr.parse>[0], {
      pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"],
    })) as
      | {
          DateTimeOriginal?: unknown
          CreateDate?: unknown
          DateTimeDigitized?: unknown
        }
      | undefined

    if (!tags) {
      return null
    }

    for (const candidate of [
      tags.DateTimeOriginal,
      tags.CreateDate,
      tags.DateTimeDigitized,
    ]) {
      if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
        return candidate
      }
    }

    return null
  } catch {
    return null
  }
}

/** Last path segment of a `blip_media.storage_key` (the derived filename component). */
export function storageKeyBaseName(storageKey: string): string | null {
  const trimmed = storageKey.trim()
  if (!trimmed) {
    return null
  }
  const slash = trimmed.lastIndexOf("/")
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

/**
 * Per-blip filename allocator. Tracks the names handed out within each blip so
 * timestamp collisions (e.g. burst photos in the same second) get a `-{k}`
 * suffix, and metadata-less files get a stable `{blipId}-{n}` sequence.
 *
 * Stateful by design (one instance per `uploadStore`); the individual decisions
 * it makes are otherwise pure and covered by the unit tests.
 */
export function createFilenameAllocator() {
  // blipId -> set of base names already assigned within that blip folder.
  const usedNames = new Map<string, Set<string>>()
  // blipId -> next sequence number for the `{blipId}-{n}` fallback.
  const fallbackSeq = new Map<string, number>()

  const namesFor = (blipId: string): Set<string> => {
    let set = usedNames.get(blipId)
    if (!set) {
      set = new Set<string>()
      usedNames.set(blipId, set)
    }
    return set
  }

  const ensureUnique = (blipId: string, candidate: string): string => {
    const taken = namesFor(blipId)
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
    let suffix = 1
    let next = `${candidate}-${suffix}`
    while (taken.has(next)) {
      suffix += 1
      next = `${candidate}-${suffix}`
    }
    taken.add(next)
    return next
  }

  const nextFallback = (blipId: string): string => {
    const current = fallbackSeq.get(blipId) ?? 0
    const next = current + 1
    fallbackSeq.set(blipId, next)
    return `${blipId}-${next}`
  }

  return {
    /**
     * Derive the `{ name, ext }` for a file being added to a blip.
     *
     * @param file       Name/type used for extension + media-type derivation.
     * @param blipId      The owning blip's id (key namespace + collision scope).
     * @param data        Optional bytes for EXIF extraction (images only).
     * @param isClipboard Whether the file originated from a clipboard paste.
     */
    async allocate(params: {
      file: FileLike
      blipId: string
      data?: ExifInput
      isClipboard?: boolean
    }): Promise<DerivedFilename> {
      const { file, blipId, data, isClipboard = false } = params
      const ext = extensionForFile(file, { isClipboard })

      if (isClipboard) {
        const name = ensureUnique(
          blipId,
          `sc-${formatClipboardTimestamp(new Date())}`,
        )
        return { name, ext }
      }

      const exifDate =
        data != null && mediaTypeForFile(file) === "image"
          ? await readExifTimestamp(data)
          : null

      if (exifDate) {
        const name = ensureUnique(blipId, formatExifTimestamp(exifDate))
        return { name, ext }
      }

      // No EXIF and not a paste: fall back to the incrementing blip sequence.
      // `nextFallback` is already unique, but route it through `ensureUnique` so
      // the name is also registered in the collision set.
      const name = ensureUnique(blipId, nextFallback(blipId))
      return { name, ext }
    },

    /**
     * Register committed `storage_key` values already on the blip so a reopened
     * composer session does not reuse `{blipId}-{n}` (or timestamp) names and
     * collide with existing R2 objects / `blip_media` rows.
     */
    seedExisting(blipId: string, storageKeys: string[]): void {
      const taken = namesFor(blipId)
      const fallbackPrefix = `${blipId}-`

      for (const storageKey of storageKeys) {
        const name = storageKeyBaseName(storageKey)
        if (!name) {
          continue
        }
        taken.add(name)

        if (!name.startsWith(fallbackPrefix)) {
          continue
        }

        const suffix = name.slice(fallbackPrefix.length)
        const match = /^(\d+)$/.exec(suffix)
        if (!match) {
          continue
        }

        const sequence = Number.parseInt(match[1]!, 10)
        if (Number.isNaN(sequence)) {
          continue
        }

        fallbackSeq.set(blipId, Math.max(fallbackSeq.get(blipId) ?? 0, sequence))
      }
    },
  }
}

export type FilenameAllocator = ReturnType<typeof createFilenameAllocator>
