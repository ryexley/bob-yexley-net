/**
 * uploadStore — the Uppy wrapper that owns the upload lifecycle.
 *
 * Position in the stack (spec §10): sits above the Uppy-agnostic `r2Service` and
 * below Phase 4's `mediaStore`. It adapts Uppy's unified `@uppy/aws-s3` plugin
 * (single-PUT < 100MiB, S3 multipart >= 100MiB) onto `r2Service`'s plain-param
 * methods, derives filenames/keys, exposes reactive SolidJS accessors over Uppy's
 * internal state, triggers `/api/media/process` for images, and emits a completed
 * payload upward via `onUploadSuccess`.
 *
 * Consumers never touch Uppy directly.
 */
import Uppy, { type UppyFile } from "@uppy/core"
import AwsS3 from "@uppy/aws-s3"
import type { Accessor } from "solid-js"
import { createSignal } from "solid-js"
import { api } from "@/urls"
import { r2Service as defaultR2Service, type R2Service } from "./r2-service"
import {
  createFilenameAllocator,
  mediaTypeForFile,
  shouldProcess,
  type MediaType,
} from "./filename"
import { MediaVariant, variantKey } from "./media-utils"
import {
  extractThumbnail as defaultExtractThumbnail,
  type ExtractedThumbnail,
} from "./thumbnail-extract"
import type { MediaResult, ProcessMediaResponse, UploadPart } from "./types"

/**
 * Single-PUT below this size, S3 multipart at or above it. Matches Uppy's own
 * default (`@uppy/aws-s3`) and the Phase 1 handoff ("100MB"); expressed in MiB so
 * it lines up with Uppy's internal default exactly.
 */
export const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024

/** Per-file ceiling (spec §2: 150MB across all media types). */
export const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024

/** Concurrent upload limit (spec §10.2: 3–4). */
const UPLOAD_CONCURRENCY = 4

/**
 * Single-PUT below the threshold, S3 multipart at or above it. Exported so the
 * boundary is unit-testable; the live multipart round-trip itself is proven by
 * scripts/r2-presign-check.mjs + scripts/media-upload-check.mjs against real R2.
 */
export function useMultipart(size: number): boolean {
  return size >= MULTIPART_THRESHOLD_BYTES
}

/** Accepted upload types (spec §2), by mime and by extension. */
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".webm",
]

export type UploadStatus =
  | "pending"
  | "uploading"
  | "processing"
  | "complete"
  | "error"

export type ProcessingStatus = "pending" | "complete" | "failed"

export type UploadVariants = ProcessMediaResponse["variants"]

/** Reactive per-file view exposed to consumers. */
export type UploadFile = {
  /** Uppy file id. */
  id: string
  /** Base storage key (no extension) — becomes `blip_media.storage_key`. */
  key: string
  /** Full object key actually uploaded: `{key}-original.{ext}`. */
  originalKey: string
  /** Original client filename (for display). */
  name: string
  blipId: string
  userId: string
  mediaType: MediaType
  mimeType: string
  /** Original file size in bytes. */
  size: number
  status: UploadStatus
  /** 0–100. */
  progress: number
  /** Object URL for the original file (image blob, or video/GIF for playback). */
  previewUrl?: string
  /** Client-extracted first-frame WebP blob URL (video/GIF strip poster only). */
  thumbPreviewUrl?: string
  error?: string
  processingStatus: ProcessingStatus
  /** Source dimensions (images: once processed; video/GIF: from first-frame extraction). */
  width?: number
  height?: number
  /** Whole-second duration (videos, from first-frame extraction). */
  durationS?: number
  /** Generated WebP variant keys + dims (images, once processed). */
  variants?: UploadVariants
}

/** Payload handed to `onUploadSuccess` once a file is fully done (Phase 4 persists it). */
export type UploadSuccess = {
  id: string
  blipId: string
  userId: string
  /** Base storage key (no extension). */
  storageKey: string
  /** Full uploaded original object key. */
  originalKey: string
  mediaType: MediaType
  mimeType: string
  fileSize: number
  processingStatus: ProcessingStatus
  width?: number
  height?: number
  durationS?: number
  variants?: UploadVariants
}

export type UploadStoreOptions = {
  /** Fired after each file finishes uploading (and processing, for images). */
  onUploadSuccess?: (success: UploadSuccess) => void
  /** Injectable for testing; defaults to the real `r2Service`. */
  r2Service?: R2Service
  /** Injectable for testing; defaults to a POST to `/api/media/process`. */
  processMedia?: (originalKey: string) => Promise<ProcessMediaResponse>
  /** Injectable for testing; defaults to client-side video/GIF frame extraction. */
  extractThumbnail?: (
    file: File,
    mediaType: MediaType,
  ) => Promise<ExtractedThumbnail | null>
}

export type UploadStore = {
  files: Accessor<UploadFile[]>
  allComplete: Accessor<boolean>
  hasErrors: Accessor<boolean>
  activeCount: Accessor<number>
  addFiles: (
    files: File[],
    blipId: string,
    userId: string,
    options?: { source?: "picker" | "clipboard" },
  ) => Promise<void>
  startQueue: () => Promise<void>
  removeFile: (id: string) => void
  retryFile: (id: string) => void
  clearCompleted: () => void
  /** Tear down the Uppy instance + revoke any object URLs. */
  destroy: () => void
  /** Reserve names from committed rows before allocating keys for new uploads. */
  seedExistingStorageKeys: (blipId: string, storageKeys: string[]) => void
}

/** Internal Uppy metadata carried per file so the S3 hooks can read the key. */
type MediaMeta = {
  /** Full original object key to upload to. */
  key: string
  /** Base storage key (no extension). */
  baseKey: string
  contentType: string
  mediaType: MediaType
}

type MediaUppyFile = UppyFile<MediaMeta, Record<string, never>>

const buildBaseKey = (userId: string, blipId: string, name: string): string =>
  `media/${userId}/${blipId}/${name}`

const buildOriginalKey = (baseKey: string, ext: string): string =>
  `${baseKey}-original.${ext}`

/** Default `/api/media/process` caller, parsing the shared `MediaResult` envelope. */
async function defaultProcessMedia(
  originalKey: string,
): Promise<ProcessMediaResponse> {
  const response = await fetch(api.media.process, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: originalKey }),
  })

  let payload: MediaResult<ProcessMediaResponse> | null = null
  try {
    payload = (await response.json()) as MediaResult<ProcessMediaResponse>
  } catch {
    payload = null
  }

  if (!response.ok || !payload || payload.error || payload.data == null) {
    throw new Error(
      payload?.error || `Media processing failed (${response.status})`,
    )
  }

  return payload.data
}

export function createUploadStore(
  options: UploadStoreOptions = {},
): UploadStore {
  const {
    onUploadSuccess,
    r2Service = defaultR2Service,
    processMedia = defaultProcessMedia,
    extractThumbnail = defaultExtractThumbnail,
  } = options

  const allocator = createFilenameAllocator()

  // Per-file first-frame extraction kicked off at add time (video/GIF only) and
  // awaited at upload-success so the original upload and the thumbnail decode run
  // in parallel.
  const thumbPromises = new Map<string, Promise<ExtractedThumbnail | null>>()

  // Source of truth for per-file view state. Kept in a Map keyed by Uppy id and
  // mirrored into a signal array so consumers get fine-grained reactivity without
  // depending on Uppy internals.
  const byId = new Map<string, UploadFile>()
  const [files, setFiles] = createSignal<UploadFile[]>([])

  const emit = (): void => {
    setFiles([...byId.values()])
  }

  const patch = (id: string, changes: Partial<UploadFile>): void => {
    const current = byId.get(id)
    if (!current) {
      return
    }
    byId.set(id, { ...current, ...changes })
    emit()
  }

  const applyThumbPreview = (fileId: string, thumb: ExtractedThumbnail): void => {
    if (!byId.has(fileId)) {
      return
    }
    if (typeof URL === "undefined" || !URL.createObjectURL) {
      return
    }
    const entry = byId.get(fileId)!
    const next = URL.createObjectURL(thumb.blob)
    const prev = entry.thumbPreviewUrl
    patch(fileId, { thumbPreviewUrl: next })
    if (prev?.startsWith("blob:")) {
      URL.revokeObjectURL(prev)
    }
  }

  const uppy = new Uppy<MediaMeta, Record<string, never>>({
    autoProceed: false,
    restrictions: {
      maxFileSize: MAX_FILE_SIZE_BYTES,
      allowedFileTypes: ALLOWED_FILE_TYPES,
    },
  })

  uppy.use(AwsS3, {
    limit: UPLOAD_CONCURRENCY,
    shouldUseMultipart: (file: MediaUppyFile) => useMultipart(file.size ?? 0),

    // --- Single-PUT (< 100MiB) ---
    getUploadParameters: (file: MediaUppyFile) =>
      r2Service.getUploadParameters({
        key: file.meta.key,
        contentType: file.meta.contentType,
      }),

    // --- Multipart (>= 100MiB) ---
    createMultipartUpload: (file: MediaUppyFile) =>
      r2Service.createMultipartUpload({
        key: file.meta.key,
        contentType: file.meta.contentType,
      }),

    signPart: async (
      _file: MediaUppyFile,
      opts: { key: string; uploadId: string; partNumber: number },
    ) => {
      const url = await r2Service.signPart({
        key: opts.key,
        uploadId: opts.uploadId,
        partNumber: opts.partNumber,
      })
      return { url }
    },

    listParts: (
      _file: MediaUppyFile,
      opts: { key: string; uploadId: string },
    ) => r2Service.listParts({ key: opts.key, uploadId: opts.uploadId }),

    completeMultipartUpload: (
      _file: MediaUppyFile,
      opts: {
        key: string
        uploadId: string
        parts: Array<{ PartNumber?: number; ETag?: string }>
      },
    ) => {
      const parts: UploadPart[] = opts.parts
        .filter(
          (part): part is UploadPart =>
            part.PartNumber != null && part.ETag != null,
        )
        .map(part => ({ PartNumber: part.PartNumber, ETag: part.ETag }))
      return r2Service.completeMultipartUpload({
        key: opts.key,
        uploadId: opts.uploadId,
        parts,
      })
    },

    abortMultipartUpload: (
      _file: MediaUppyFile,
      opts: { key: string; uploadId: string },
    ) => r2Service.abortMultipartUpload({ key: opts.key, uploadId: opts.uploadId }),
  })

  const revokePreview = (entry?: UploadFile): void => {
    if (typeof URL === "undefined" || !URL.revokeObjectURL) {
      return
    }
    if (entry?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(entry.previewUrl)
    }
    if (entry?.thumbPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(entry.thumbPreviewUrl)
    }
  }

  const finishSuccess = (entry: UploadFile): void => {
    onUploadSuccess?.({
      id: entry.id,
      blipId: entry.blipId,
      userId: entry.userId,
      storageKey: entry.key,
      originalKey: entry.originalKey,
      mediaType: entry.mediaType,
      mimeType: entry.mimeType,
      fileSize: entry.size,
      processingStatus: entry.processingStatus,
      width: entry.width,
      height: entry.height,
      durationS: entry.durationS,
      variants: entry.variants,
    })
  }

  /**
   * Finalize a video/GIF after its original lands: await the (parallel) first
   * frame extraction, upload the static `-thumb.webp` (best-effort — a missing
   * thumb degrades to the pre-thumb render behavior), record the extracted
   * dimensions/duration, then mark complete and emit. `processing_status` stays
   * `complete` regardless: thumbnails are non-blocking and video/GIF carry no
   * server-side variant generation (spec §4.2).
   */
  const finalizeNonImage = async (fileId: string): Promise<void> => {
    if (!byId.has(fileId)) {
      return
    }
    patch(fileId, { status: "processing", progress: 100 })

    const thumb = await (thumbPromises.get(fileId) ?? Promise.resolve(null))
    thumbPromises.delete(fileId)

    const entry = byId.get(fileId)
    if (entry && thumb) {
      patch(fileId, {
        width: thumb.width,
        height: thumb.height,
        durationS: thumb.durationS,
      })
      try {
        await r2Service.uploadObject({
          key: variantKey(entry.key, MediaVariant.Thumb),
          body: thumb.blob,
          contentType: "image/webp",
        })
      } catch (error) {
        // The original uploaded fine and is usable; only the thumbnail failed.
        console.error("Failed to upload media thumbnail:", error)
      }
    }

    patch(fileId, {
      status: "complete",
      progress: 100,
      processingStatus: "complete",
    })
    const finalized = byId.get(fileId)
    if (finalized) {
      finishSuccess(finalized)
    }
  }

  uppy.on("upload-progress", (file, progress) => {
    if (!file) {
      return
    }
    patch(file.id, {
      status: "uploading",
      progress: Math.round(progress.percentage ?? 0),
    })
  })

  uppy.on("upload-error", (file, error) => {
    if (!file) {
      return
    }
    patch(file.id, {
      status: "error",
      error: error?.message ?? "Upload failed",
    })
  })

  uppy.on("upload-success", file => {
    if (!file) {
      return
    }
    const entry = byId.get(file.id)
    if (!entry) {
      return
    }

    // Videos and GIFs skip server-side variant generation, but get a
    // client-extracted static `-thumb.webp` first frame uploaded before emitting.
    if (!shouldProcess(entry)) {
      void finalizeNonImage(file.id)
      return
    }

    // Images: trigger server-side WebP variant generation, then surface the keys.
    patch(file.id, { status: "processing", progress: 100 })
    void processMedia(entry.originalKey)
      .then(result => {
        patch(file.id, {
          status: "complete",
          processingStatus: "complete",
          width: result.original.width,
          height: result.original.height,
          variants: result.variants,
        })
        finishSuccess(byId.get(file.id)!)
      })
      .catch((error: unknown) => {
        // The original uploaded fine and is usable; only variant generation
        // failed. Don't flip the file to an upload error (which would block
        // publish) — record the failure and let the caller decide.
        patch(file.id, {
          status: "complete",
          processingStatus: "failed",
          error:
            error instanceof Error ? error.message : "Media processing failed",
        })
        finishSuccess(byId.get(file.id)!)
      })
  })

  uppy.on("file-removed", file => {
    if (!file) {
      return
    }
    const entry = byId.get(file.id)
    revokePreview(entry)
    byId.delete(file.id)
    thumbPromises.delete(file.id)
    emit()
  })

  const addFiles: UploadStore["addFiles"] = async (
    incoming,
    blipId,
    userId,
    addOptions = {},
  ) => {
    const isClipboard = addOptions.source === "clipboard"

    for (const file of incoming) {
      const data = await file.arrayBuffer()
      const { name, ext } = await allocator.allocate({
        file: { name: file.name, type: file.type },
        blipId,
        data,
        isClipboard,
      })

      const baseKey = buildBaseKey(userId, blipId, name)
      const originalKey = buildOriginalKey(baseKey, ext)
      const contentType = file.type || "application/octet-stream"
      const mediaType = mediaTypeForFile({ name: file.name, type: file.type })

      let fileId: string
      try {
        fileId = uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
          meta: { key: originalKey, baseKey, contentType, mediaType },
        })
      } catch (error) {
        // Restriction failures (size/type) are reported via Uppy's logger +
        // `restriction-failed` event; skip adding our own entry for them.
        console.error("Skipped file rejected by upload restrictions:", error)
        continue
      }

      const previewUrl =
        typeof URL !== "undefined" && URL.createObjectURL
          ? URL.createObjectURL(file)
          : undefined

      byId.set(fileId, {
        id: fileId,
        key: baseKey,
        originalKey,
        name: file.name,
        blipId,
        userId,
        mediaType,
        mimeType: contentType,
        size: file.size,
        status: "pending",
        progress: 0,
        previewUrl,
        processingStatus: "pending",
      })

      // Decode the first frame in parallel with the upload (video/GIF only); the
      // result is awaited and uploaded as `-thumb.webp` in `finalizeNonImage`.
      if (mediaType === "video" || mediaType === "gif") {
        thumbPromises.set(
          fileId,
          extractThumbnail(file, mediaType)
            .then(thumb => {
              if (thumb) {
                applyThumbPreview(fileId, thumb)
              }
              return thumb
            })
            .catch((error: unknown) => {
              console.error("Thumbnail extraction failed:", error)
              return null
            }),
        )
      }
    }

    emit()
  }

  const startQueue: UploadStore["startQueue"] = async () => {
    try {
      await uppy.upload()
    } catch (error) {
      console.error("Upload queue failed:", error)
    }
  }

  const removeFile: UploadStore["removeFile"] = id => {
    const entry = byId.get(id)
    if (!entry) {
      return
    }

    // Completed uploads are already in R2: delete the original (+ any variants).
    // In-flight uploads are aborted by `uppy.removeFile` (multipart abort runs
    // through our `abortMultipartUpload` hook). Deletes are fire-and-forget
    // (spec §5.4) — the UI removes the thumbnail regardless of outcome.
    if (entry.status === "complete") {
      const keysToDelete = [
        entry.originalKey,
        ...(entry.variants
          ? [
              entry.variants.micro.key,
              entry.variants.small.key,
              entry.variants.medium.key,
              entry.variants.large.key,
            ]
          : []),
        // Video/GIF carry a client-extracted static thumbnail (best-effort, so it
        // may not exist — the delete is fire-and-forget either way).
        ...(entry.mediaType === "video" || entry.mediaType === "gif"
          ? [variantKey(entry.key, MediaVariant.Thumb)]
          : []),
      ]
      for (const key of keysToDelete) {
        void r2Service.deleteObject(key).catch((error: unknown) => {
          console.error(`Failed to delete R2 object ${key}:`, error)
        })
      }
    }

    // Triggers the `file-removed` handler, which revokes the preview + drops the
    // entry from our map.
    uppy.removeFile(id)
  }

  const retryFile: UploadStore["retryFile"] = id => {
    if (!byId.has(id)) {
      return
    }
    patch(id, { status: "uploading", error: undefined })
    void uppy.retryUpload(id).catch((error: unknown) => {
      console.error("Retry failed:", error)
    })
  }

  const clearCompleted: UploadStore["clearCompleted"] = () => {
    for (const entry of [...byId.values()]) {
      if (entry.status === "complete") {
        // Removes from Uppy state too; `file-removed` revokes + drops the entry.
        uppy.removeFile(entry.id)
      }
    }
  }

  const destroy: UploadStore["destroy"] = () => {
    for (const entry of byId.values()) {
      revokePreview(entry)
    }
    byId.clear()
    thumbPromises.clear()
    emit()
    void uppy.destroy()
  }

  const allComplete: Accessor<boolean> = () =>
    files().every(file => file.status === "complete")
  const hasErrors: Accessor<boolean> = () =>
    files().some(file => file.status === "error")
  const activeCount: Accessor<number> = () =>
    files().filter(
      file =>
        file.status === "pending" ||
        file.status === "uploading" ||
        file.status === "processing",
    ).length

  const seedExistingStorageKeys: UploadStore["seedExistingStorageKeys"] = (
    blipId,
    storageKeys,
  ) => {
    allocator.seedExisting(blipId, storageKeys)
  }

  return {
    files,
    allComplete,
    hasErrors,
    activeCount,
    addFiles,
    startQueue,
    removeFile,
    retryFile,
    clearCompleted,
    destroy,
    seedExistingStorageKeys,
  }
}
