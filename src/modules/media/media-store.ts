/**
 * mediaStore — Phase 4 coordinator (spec §10.3).
 *
 * A `supaStore` factory wrapper over `blip_media` (same pattern as `blipStore`),
 * scoped to a single blip. It owns one `uploadStore` instance, persists the
 * `blip_media` rows that `uploadStore` emits via `onUploadSuccess`, and exposes a
 * unified `attachments` view that merges in-flight uploads with committed rows.
 *
 * Layering (spec §10): `view / blipStore -> mediaStore -> uploadStore -> r2Service`.
 * mediaStore never touches Uppy/R2 directly and never calls `/api/media/process`
 * (uploadStore already does, handing back variant keys/dims in `UploadSuccess`).
 *
 * Key constraints handled here:
 * - FK gotcha: `blip_media.blip_id -> blips.id` (`on delete cascade`), but the
 *   blips row is created lazily by `BlipEditor`. mediaStore forces it to exist via
 *   an injected `ensureBlipPersisted` callback before the first insert (the
 *   dependency points down: the editor owns blip persistence, mediaStore asks).
 * - `blip_media` has no `updated_at` column — never use `updateWithTimestamp`.
 * - The shared `supaStore` cache holds the whole table; `records` is scoped to
 *   this blip by `blip_id`. Whole-table realtime is disabled (`subscribe: false`);
 *   a scoped `blip_media` channel is deferred to the reader UI (spec §13.5).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { Accessor, createEffect, createMemo, createSignal } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { supaStore, type OperationResult } from "@/lib/data/supa-store"
import type { Tables } from "@/types/database.types"
import {
  createUploadStore as defaultCreateUploadStore,
  type UploadFile,
  type UploadStore,
  type UploadStoreOptions,
  type UploadSuccess,
} from "./upload-store"
import type { MediaType } from "./filename"
import { r2Service as defaultR2Service, type R2Service } from "./r2-service"
import {
  MediaVariant,
  originalKey,
  originalUrl,
  variantKey,
  variantUrl,
} from "./media-utils"

export type BlipMedia = Tables<"blip_media">

export type AttachmentStatus =
  | "pending"
  | "uploading"
  | "processing"
  | "complete"
  | "error"
  | "saved"

/** Unified composer item — an in-flight upload or a committed row, keyed by storage_key. */
export type Attachment = {
  /** Base storage key (`UploadFile.key` === `blip_media.storage_key`). */
  key: string
  /** Image preview, or legacy single URL when poster/media are not split. */
  previewUrl?: string
  /** Static frame for video/GIF strip tiles (`-thumb.webp` or extracted blob). */
  posterUrl?: string
  /** Original video/GIF URL for `<video>` fallback and composer preview. */
  mediaSrc?: string
  status: AttachmentStatus
  /** 0–100, present while uploading. */
  progress?: number
  /** `image | video | gif` — drives preview rendering for both in-flight and committed items. */
  mediaType?: MediaType
  /** Present once the row is committed. */
  record?: BlipMedia
}

export type MediaStoreOptions = {
  blipId: string
  userId: string
  /**
   * Force the parent `blips` row to exist before the first `blip_media` insert
   * (FK gotcha). Resolves `true` once persisted, `false` to abort the insert.
   * Supplied by `BlipEditor`; omitting it assumes the row already exists.
   */
  ensureBlipPersisted?: () => Promise<boolean>
  /** Injectable for tests; defaults to the real `r2Service`. */
  r2Service?: R2Service
  /** Injectable for tests; defaults to the real `createUploadStore`. */
  createUploadStore?: (options: UploadStoreOptions) => UploadStore
  /** Passed through to the upload store (injectable in tests). */
  processMedia?: UploadStoreOptions["processMedia"]
  /** Disabled by default — whole-table realtime is not wanted here. */
  subscribe?: boolean
  /** Fired after each `blip_media` row is persisted (e.g. refresh reader UI). */
  onMediaPersisted?: (record: BlipMedia) => void
}

// Module-level singleton: like `blipStore`, all instances share one cache so
// records survive editor re-scoping. `records` filters the shared table by blip.
const _mediaStore = supaStore<BlipMedia>("blip_media")

export function mediaStore(
  supabaseClient: SupabaseClient,
  options: MediaStoreOptions,
) {
  const {
    blipId,
    userId,
    ensureBlipPersisted,
    r2Service = defaultR2Service,
    createUploadStore = defaultCreateUploadStore,
    processMedia,
    subscribe = false,
    onMediaPersisted,
  } = options

  const store = _mediaStore(supabaseClient, {
    subscribe,
    orderBy: "display_order",
    orderDirection: "asc",
  })

  const [persistError, setPersistError] = createSignal<string | null>(null)

  // Persistence is serialized so (a) only the first `onUploadSuccess` triggers
  // `ensureBlipPersisted` and the rest await it, and (b) `display_order` is read
  // from settled state — no races across Uppy's concurrent completions.
  let persistChain: Promise<void> = Promise.resolve()
  let inFlightPersists = 0
  let blipEnsured = false
  // storage_keys whose insert failed — kept visible so the author can retry/remove.
  const failedKeys = new Set<string>()

  const records = createMemo<BlipMedia[]>(() =>
    store
      .entities()
      .filter(record => record.blip_id === blipId)
      .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0)),
  )

  const attachmentUrlsForRecord = (
    record: BlipMedia,
  ): Pick<Attachment, "previewUrl" | "posterUrl" | "mediaSrc"> => {
    if (record.media_type === "video" || record.media_type === "gif") {
      const posterUrl =
        record.processing_status === "complete"
          ? variantUrl(record.storage_key, MediaVariant.Thumb)
          : undefined
      const mediaSrc = originalUrl(record.storage_key, record.mime_type)
      return { posterUrl, mediaSrc, previewUrl: posterUrl }
    }
    const previewUrl =
      record.processing_status === "complete"
        ? variantUrl(record.storage_key, MediaVariant.Small)
        : originalUrl(record.storage_key, record.mime_type)
    return { previewUrl }
  }

  const attachmentUrlsForUpload = (
    file: UploadFile,
  ): Pick<Attachment, "previewUrl" | "posterUrl" | "mediaSrc"> => {
    if (file.mediaType === "video" || file.mediaType === "gif") {
      return {
        posterUrl: file.thumbPreviewUrl,
        mediaSrc: file.previewUrl,
      }
    }
    return { previewUrl: file.previewUrl }
  }

  /** Pure merge of committed rows + in-flight uploads (spec §10.3 ordering). */
  const buildAttachmentsList = (
    committed: BlipMedia[],
    inFlight: UploadFile[],
  ): Attachment[] => {
    const byKey = new Map<string, Attachment>()
    for (const record of committed) {
      byKey.set(record.storage_key, {
        key: record.storage_key,
        ...attachmentUrlsForRecord(record),
        status: "saved",
        mediaType: record.media_type as MediaType,
        record,
      })
    }

    for (const file of inFlight) {
      const existing = byKey.get(file.key)
      if (existing) {
        const live = attachmentUrlsForUpload(file)
        if (file.mediaType === "video" || file.mediaType === "gif") {
          if (live.posterUrl) {
            existing.posterUrl = live.posterUrl
          }
          if (live.mediaSrc) {
            existing.mediaSrc = live.mediaSrc
          }
        } else if (live.previewUrl) {
          existing.previewUrl = live.previewUrl
        }
        continue
      }
      byKey.set(file.key, {
        key: file.key,
        ...attachmentUrlsForUpload(file),
        status: file.status,
        progress: file.progress,
        mediaType: file.mediaType,
      })
    }

    const ordered: Attachment[] = []
    const seen = new Set<string>()
    for (const record of committed) {
      const attachment = byKey.get(record.storage_key)
      if (attachment && !seen.has(attachment.key)) {
        ordered.push(attachment)
        seen.add(attachment.key)
      }
    }
    for (const file of inFlight) {
      if (seen.has(file.key)) {
        continue
      }
      const attachment = byKey.get(file.key)
      if (attachment) {
        ordered.push(attachment)
        seen.add(attachment.key)
      }
    }
    return ordered
  }

  const persistOne = async (success: UploadSuccess): Promise<void> => {
    if (!blipEnsured) {
      const ensured = ensureBlipPersisted ? await ensureBlipPersisted() : true
      if (!ensured) {
        failedKeys.add(success.storageKey)
        setPersistError("Unable to persist the blip before saving media")
        return
      }
      blipEnsured = true
    }

    const nextOrder =
      records().reduce(
        (max, record) => Math.max(max, record.display_order ?? 0),
        -1,
      ) + 1

    let result: OperationResult<BlipMedia>
    try {
      result = await store.create({
        blip_id: success.blipId,
        user_id: success.userId,
        media_type: success.mediaType,
        mime_type: success.mimeType,
        storage_key: success.storageKey,
        file_size: success.fileSize,
        processing_status: success.processingStatus,
        width: success.width ?? null,
        height: success.height ?? null,
        duration_s: success.durationS ?? null,
        display_order: nextOrder,
      } as Partial<BlipMedia>)
    } catch (error) {
      failedKeys.add(success.storageKey)
      setPersistError(
        error instanceof Error ? error.message : "Failed to save media record",
      )
      return
    }

    if (result.error || !result.data) {
      failedKeys.add(success.storageKey)
      setPersistError(result.error ?? "Failed to save media record")
      return
    }

    failedKeys.delete(success.storageKey)
    onMediaPersisted?.(result.data)
  }

  // Drop persisted uploads from Uppy state only once everything has settled and
  // no insert failed. `clearCompleted` is all-or-nothing, so clearing per-file
  // would prematurely discard sibling completed-but-unpersisted (or failed)
  // files; the `attachments` merge dedupes by key meanwhile, so lingering
  // completed uploads never render twice.
  const maybeClearCompleted = (): void => {
    if (
      inFlightPersists === 0 &&
      failedKeys.size === 0 &&
      upload.activeCount() === 0
    ) {
      upload.clearCompleted()
    }
  }

  const enqueuePersist = (success: UploadSuccess): void => {
    inFlightPersists += 1
    persistChain = persistChain
      // persistOne reads `records()` for a point-in-time display_order, not as a
      // reactive dependency — the serialized chain is intentionally untracked.
      // eslint-disable-next-line solid/reactivity
      .then(() => persistOne(success))
      .catch((error: unknown) => {
        console.error("Failed to persist blip media:", error)
      })
      .finally(() => {
        inFlightPersists -= 1
        maybeClearCompleted()
      })
  }

  const upload = createUploadStore({
    r2Service,
    processMedia,
    onUploadSuccess: enqueuePersist,
  })

  const seedUploadKeysFromRecords = (rows: BlipMedia[]): void => {
    if (rows.length === 0) {
      return
    }
    upload.seedExistingStorageKeys(
      blipId,
      rows.map(record => record.storage_key),
    )
  }

  // Rows may already live in the module-level cache from a prior editor session.
  seedUploadKeysFromRecords(records())

  const uploads = upload.files
  const allComplete = upload.allComplete
  const hasErrors = upload.hasErrors
  const activeCount = upload.activeCount

  const [attachmentState, setAttachmentState] = createStore<{ items: Attachment[] }>({
    items: [],
  })

  createEffect(() => {
    const next = buildAttachmentsList(records(), uploads())
    setAttachmentState("items", reconcile(next, { key: "key" }))
  })

  const attachments: Accessor<Attachment[]> = () => attachmentState.items

  const hasMedia: Accessor<boolean> = () => attachments().length > 0
  // Failed *processing* (images) does not block publish — only in-flight/errored
  // uploads do (spec §5.3 / handoff). `hasErrors` counts upload errors only.
  const canPublish: Accessor<boolean> = () =>
    upload.allComplete() && !upload.hasErrors()

  const attach = async (
    files: File[],
    attachOptions: { source?: "picker" | "clipboard" } = {},
  ): Promise<void> => {
    setPersistError(null)
    seedUploadKeysFromRecords(records())
    await upload.addFiles(files, blipId, userId, attachOptions)
    await upload.startQueue()
  }

  const deleteRecordObjects = (record: BlipMedia): void => {
    const keys = [originalKey(record.storage_key, record.mime_type)]
    // Variants only exist for images whose processing completed (spec §4.2).
    if (record.media_type === "image" && record.processing_status === "complete") {
      keys.push(
        variantKey(record.storage_key, MediaVariant.Micro),
        variantKey(record.storage_key, MediaVariant.Small),
        variantKey(record.storage_key, MediaVariant.Medium),
        variantKey(record.storage_key, MediaVariant.Large),
      )
    }
    // Video/GIF carry a client-extracted static `-thumb.webp` (best-effort, so it
    // may be absent for pre-thumb media — the delete is fire-and-forget anyway).
    if (record.media_type === "video" || record.media_type === "gif") {
      keys.push(variantKey(record.storage_key, MediaVariant.Thumb))
    }
    // Fire-and-forget (spec §5.4): the UI removes the thumbnail regardless.
    for (const key of keys) {
      void r2Service.deleteObject(key).catch((error: unknown) => {
        console.error(`Failed to delete R2 object ${key}:`, error)
      })
    }
  }

  const removeAttachment = async (key: string): Promise<void> => {
    failedKeys.delete(key)

    const record = records().find(item => item.storage_key === key)
    if (record) {
      deleteRecordObjects(record)
      try {
        await store.remove(record.id)
      } catch (error) {
        console.error("Failed to delete blip_media row:", error)
      }
    }

    // Drop any in-flight/completed upload for this key. For an in-flight file
    // this aborts the upload; for a completed one it also deletes its R2 objects
    // (idempotent with the record path above during the brief overlap window).
    const file = uploads().find(item => item.key === key)
    if (file) {
      upload.removeFile(file.id)
    }

    maybeClearCompleted()
  }

  // Retry a failed in-flight upload (spec §5.3). Maps the public storage_key
  // back to the Uppy file id and re-runs it through `uploadStore`. No-op for
  // committed rows (there is nothing to retry once saved).
  const retry = (key: string): void => {
    failedKeys.delete(key)
    setPersistError(null)
    const file = uploads().find(item => item.key === key)
    if (file) {
      upload.retryFile(file.id)
    }
  }

  const reorder = async (keys: string[]): Promise<void> => {
    const recordByKey = new Map(
      records().map(record => [record.storage_key, record]),
    )
    await Promise.all(
      keys.map(async (key, index) => {
        const record = recordByKey.get(key)
        if (!record || record.display_order === index) {
          return
        }
        try {
          await store.update(record.id, {
            display_order: index,
          } as Partial<BlipMedia>)
        } catch (error) {
          console.error("Failed to reorder blip media:", error)
        }
      }),
    )
  }

  // Load committed rows for this blip (e.g. reopening a saved draft), merging
  // into the shared cache without disturbing other blips' rows.
  const fetchByBlip = async (): Promise<OperationResult<BlipMedia[]>> => {
    try {
      const { data, error } = await supabaseClient
        .from("blip_media")
        .select("*")
        .eq("blip_id", blipId)
        .order("display_order", { ascending: true })

      if (error) {
        return { data: null, error: error.message }
      }

      const rows = (data ?? []) as BlipMedia[]
      const byId = new Map(store.entities().map(record => [record.id, record]))
      for (const row of rows) {
        byId.set(row.id, row)
      }
      store.setInitialData([...byId.values()])
      seedUploadKeysFromRecords(rows)

      return { data: rows, error: null }
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error ? error.message : "Failed to fetch blip media",
      }
    }
  }

  // Tear down the in-flight upload session and drop this blip's rows from the
  // shared cache. The DB is left intact (a saved draft keeps its committed media).
  const reset = (): void => {
    upload.destroy()
    setAttachmentState("items", reconcile([], { key: "key" }))
    store.setInitialData(
      store.entities().filter(record => record.blip_id !== blipId),
    )
    failedKeys.clear()
    blipEnsured = false
    setPersistError(null)
  }

  return {
    records,
    uploads,
    allComplete,
    hasErrors,
    activeCount,
    attachments,
    hasMedia,
    canPublish,
    persistError,
    attach,
    removeAttachment,
    retry,
    reorder,
    reset,
    fetchByBlip,
  }
}

export type MediaStore = ReturnType<typeof mediaStore>
