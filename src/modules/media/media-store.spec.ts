import { createRoot, createSignal } from "solid-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mediaStore } from "./media-store"
import type { UploadFile, UploadStore, UploadStoreOptions, UploadSuccess } from "./upload-store"
import type { R2Service } from "./r2-service"

const runInRoot = async (callback: () => Promise<void>) =>
  await new Promise<void>((resolve, reject) => {
    createRoot(dispose => {
      void callback()
        .then(() => {
          dispose()
          resolve()
        })
        .catch(error => {
          dispose()
          reject(error)
        })
    })
  })

type Result = { data: unknown; error: { message: string } | null }

type SupabaseMockConfig = {
  onInsert?: (payload: Record<string, unknown>) => Result
  onDelete?: (id: unknown) => Result
  selectRows?: Record<string, unknown>[]
}

let rowSeq = 0

const createSupabaseMock = (config: SupabaseMockConfig = {}) => {
  const inserted: Record<string, unknown>[] = []
  const deletedIds: unknown[] = []
  const updates: Array<{ id: unknown; updates: Record<string, unknown> }> = []

  const from = vi.fn((table: string) => {
    const state = {
      table,
      op: "select" as "select" | "insert" | "update" | "delete",
      payload: null as Record<string, unknown> | Record<string, unknown>[] | null,
      id: undefined as unknown,
      filters: [] as Array<[string, unknown]>,
    }

    const compute = (): Result => {
      if (state.op === "insert") {
        const payload = (
          Array.isArray(state.payload) ? state.payload[0] : state.payload
        ) as Record<string, unknown>
        inserted.push(payload)
        return (
          config.onInsert?.(payload) ?? {
            data: {
              duration_s: null,
              ...payload,
              // Server-assigned columns win over the (undefined) Insert defaults.
              id: `media-${++rowSeq}`,
              created_at: "2026-06-20T00:00:00.000Z",
            },
            error: null,
          }
        )
      }
      if (state.op === "update") {
        updates.push({
          id: state.id,
          updates: state.payload as Record<string, unknown>,
        })
        return {
          data: { id: state.id, ...(state.payload as Record<string, unknown>) },
          error: null,
        }
      }
      if (state.op === "delete") {
        deletedIds.push(state.id)
        return config.onDelete?.(state.id) ?? { data: null, error: null }
      }
      const rows = (config.selectRows ?? []).filter(row =>
        state.filters.every(([column, value]) => row[column] === value),
      )
      return { data: rows, error: null }
    }

    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      insert: vi.fn((payload: Record<string, unknown> | Record<string, unknown>[]) => {
        state.op = "insert"
        state.payload = payload
        return builder
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        state.op = "update"
        state.payload = payload
        return builder
      }),
      delete: vi.fn(() => {
        state.op = "delete"
        return builder
      }),
      eq: vi.fn((column: string, value: unknown) => {
        state.filters.push([column, value])
        if (column === "id") {
          state.id = value
        }
        return builder
      }),
      single: vi.fn(() => builder),
      maybeSingle: vi.fn(() => builder),
      then: (
        resolve: (value: Result) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(compute()).then(resolve, reject),
    }

    return builder
  })

  return {
    client: { from } as unknown as SupabaseClient,
    inserted,
    deletedIds,
    updates,
  }
}

const makeR2 = (): R2Service =>
  ({
    getUploadParameters: vi.fn(),
    createMultipartUpload: vi.fn(),
    signPart: vi.fn(),
    listParts: vi.fn(),
    completeMultipartUpload: vi.fn(),
    abortMultipartUpload: vi.fn(),
    deleteObject: vi.fn(async () => {}),
    getPublicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
  }) as unknown as R2Service

const makeFakeUpload = (blipId: string, userId: string) => {
  let onSuccess: ((success: UploadSuccess) => void) | undefined
  const [files, setFiles] = createSignal<UploadFile[]>([])

  const removeFile = vi.fn((id: string) =>
    setFiles(prev => prev.filter(file => file.id !== id)),
  )
  const clearCompleted = vi.fn(() =>
    setFiles(prev => prev.filter(file => file.status !== "complete")),
  )
  const destroy = vi.fn(() => setFiles([]))

  const fake: UploadStore = {
    files,
    allComplete: () => files().every(file => file.status === "complete"),
    hasErrors: () => files().some(file => file.status === "error"),
    activeCount: () =>
      files().filter(
        file =>
          file.status === "pending" ||
          file.status === "uploading" ||
          file.status === "processing",
      ).length,
    addFiles: vi.fn(async () => {}),
    startQueue: vi.fn(async () => {}),
    removeFile,
    retryFile: vi.fn(),
    clearCompleted,
    destroy,
    seedExistingStorageKeys: vi.fn(),
  }

  const uploadFile = (over: Partial<UploadFile> = {}): UploadFile => ({
    id: "f1",
    key: "media/user1/blip1/blip1-1",
    originalKey: "media/user1/blip1/blip1-1-original.jpg",
    name: "photo.jpg",
    blipId,
    userId,
    mediaType: "image",
    mimeType: "image/jpeg",
    size: 1234,
    status: "complete",
    progress: 100,
    processingStatus: "complete",
    ...over,
  })

  return {
    factory: (options: UploadStoreOptions) => {
      onSuccess = options.onUploadSuccess
      return fake
    },
    fake,
    setFiles,
    uploadFile,
    removeFile,
    clearCompleted,
    destroy,
    fireSuccess: (success: UploadSuccess) => onSuccess?.(success),
  }
}

const makeSuccess = (
  blipId: string,
  userId: string,
  over: Partial<UploadSuccess> = {},
): UploadSuccess => {
  const storageKey = over.storageKey ?? "media/user1/blip1/blip1-1"
  return {
    id: "f1",
    blipId,
    userId,
    storageKey,
    originalKey: `${storageKey}-original.jpg`,
    mediaType: "image",
    mimeType: "image/jpeg",
    fileSize: 1234,
    processingStatus: "complete",
    width: 3000,
    height: 2000,
    variants: {
      micro: { key: `${storageKey}-micro.webp`, width: 96, height: 64 },
      small: { key: `${storageKey}-small.webp`, width: 200, height: 133 },
      medium: { key: `${storageKey}-medium.webp`, width: 1024, height: 683 },
      large: { key: `${storageKey}-large.webp`, width: 2048, height: 1365 },
    },
    ...over,
  }
}

let testSeq = 0
const uniqueBlip = () => `blip-${++testSeq}`

beforeEach(() => {
  vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("mediaStore — onUploadSuccess persistence", () => {
  it("ensures the blip row, then inserts a blip_media row from the payload", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const ensureBlipPersisted = vi.fn(async () => true)
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)
      const storageKey = `media/user1/${blipId}/photo`

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      up.setFiles([up.uploadFile({ key: storageKey })])
      up.fireSuccess(makeSuccess(blipId, userId, { storageKey }))

      await vi.waitFor(() => expect(media.records()).toHaveLength(1))

      expect(ensureBlipPersisted).toHaveBeenCalledTimes(1)
      expect(mock.inserted[0]).toMatchObject({
        blip_id: blipId,
        user_id: userId,
        media_type: "image",
        mime_type: "image/jpeg",
        storage_key: storageKey,
        file_size: 1234,
        processing_status: "complete",
        width: 3000,
        height: 2000,
        display_order: 0,
      })

      // Settles and clears the completed upload from Uppy state.
      await vi.waitFor(() => expect(up.clearCompleted).toHaveBeenCalled())
      expect(media.persistError()).toBeNull()
    })
  })

  it("calls ensureBlipPersisted once and assigns incrementing display_order", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const ensureBlipPersisted = vi.fn(async () => true)
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      up.fireSuccess(makeSuccess(blipId, userId, { storageKey: `media/${blipId}/a` }))
      up.fireSuccess(makeSuccess(blipId, userId, { storageKey: `media/${blipId}/b` }))

      await vi.waitFor(() => expect(media.records()).toHaveLength(2))

      expect(ensureBlipPersisted).toHaveBeenCalledTimes(1)
      expect(media.records().map(record => record.display_order)).toEqual([0, 1])
    })
  })

  it("persists videos with null dimensions and complete status, no variants", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      up.fireSuccess(
        makeSuccess(blipId, userId, {
          storageKey: `media/${blipId}/clip`,
          mediaType: "video",
          mimeType: "video/mp4",
          width: undefined,
          height: undefined,
          variants: undefined,
        }),
      )

      await vi.waitFor(() => expect(media.records()).toHaveLength(1))
      expect(mock.inserted[0]).toMatchObject({
        media_type: "video",
        processing_status: "complete",
        width: null,
        height: null,
      })
    })
  })

  it("persists a processing-failed image but keeps it publishable", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      up.setFiles([
        up.uploadFile({
          key: `media/${blipId}/x`,
          status: "complete",
          processingStatus: "failed",
        }),
      ])
      up.fireSuccess(
        makeSuccess(blipId, userId, {
          storageKey: `media/${blipId}/x`,
          processingStatus: "failed",
          width: undefined,
          height: undefined,
          variants: undefined,
        }),
      )

      await vi.waitFor(() => expect(media.records()).toHaveLength(1))
      expect(mock.inserted[0]).toMatchObject({ processing_status: "failed" })
      expect(media.hasErrors()).toBe(false)
      expect(media.canPublish()).toBe(true)
    })
  })

  it("does not insert and keeps the upload when ensureBlipPersisted fails", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => false,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      up.setFiles([up.uploadFile({ key: `media/${blipId}/x` })])
      up.fireSuccess(makeSuccess(blipId, userId, { storageKey: `media/${blipId}/x` }))

      await vi.waitFor(() => expect(media.persistError()).not.toBeNull())

      expect(mock.inserted).toHaveLength(0)
      expect(media.records()).toHaveLength(0)
      expect(up.clearCompleted).not.toHaveBeenCalled()
      expect(up.fake.files()).toHaveLength(1)
    })
  })
})

describe("mediaStore — removeAttachment", () => {
  it("deletes the row plus original and variant objects for a saved image", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const storageKey = `media/${blipId}/photo`
      const r2 = makeR2()
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: r2,
      })

      up.setFiles([up.uploadFile({ key: storageKey })])
      up.fireSuccess(makeSuccess(blipId, userId, { storageKey }))
      await vi.waitFor(() => expect(media.records()).toHaveLength(1))

      await media.removeAttachment(storageKey)

      expect(mock.deletedIds).toHaveLength(1)
      const deletedKeys = (r2.deleteObject as ReturnType<typeof vi.fn>).mock.calls.map(
        ([key]) => key,
      )
      expect(deletedKeys).toContain(`${storageKey}-original.jpg`)
      expect(deletedKeys).toContain(`${storageKey}-micro.webp`)
      expect(deletedKeys).toContain(`${storageKey}-small.webp`)
      expect(deletedKeys).toContain(`${storageKey}-medium.webp`)
      expect(deletedKeys).toContain(`${storageKey}-large.webp`)
      expect(media.records()).toHaveLength(0)
    })
  })

  it("deletes the original + static thumbnail for a saved video (no image variants)", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const storageKey = `media/${blipId}/clip`
      const r2 = makeR2()
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: r2,
      })

      up.fireSuccess(
        makeSuccess(blipId, userId, {
          storageKey,
          mediaType: "video",
          mimeType: "video/mp4",
          width: undefined,
          height: undefined,
          variants: undefined,
        }),
      )
      await vi.waitFor(() => expect(media.records()).toHaveLength(1))

      await media.removeAttachment(storageKey)

      const deletedKeys = (r2.deleteObject as ReturnType<typeof vi.fn>).mock.calls.map(
        ([key]) => key,
      )
      expect(deletedKeys).toEqual([
        `${storageKey}-original.mp4`,
        `${storageKey}-thumb.webp`,
      ])
    })
  })
})

describe("mediaStore — fetchByBlip", () => {
  it("loads committed rows scoped to the blip", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const storageKey = `media/${blipId}/photo`
      const mock = createSupabaseMock({
        selectRows: [
          {
            id: "row-1",
            blip_id: blipId,
            user_id: "user1",
            media_type: "image",
            mime_type: "image/jpeg",
            storage_key: storageKey,
            processing_status: "complete",
            file_size: 10,
            width: 100,
            height: 100,
            duration_s: null,
            display_order: 0,
            created_at: "2026-06-20T00:00:00.000Z",
          },
        ],
      })
      const up = makeFakeUpload(blipId, "user1")

      const media = mediaStore(mock.client, {
        blipId,
        userId: "user1",
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      const result = await media.fetchByBlip()

      expect(result.error).toBeNull()
      expect(media.records()).toHaveLength(1)
      expect(media.records()[0].storage_key).toBe(storageKey)
      expect(media.hasMedia()).toBe(true)
      expect(up.fake.seedExistingStorageKeys).toHaveBeenCalledWith(blipId, [
        storageKey,
      ])
    })
  })
})

describe("mediaStore — retry", () => {
  it("re-runs the matching in-flight upload and clears persistError", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const storageKey = `media/${blipId}/x`
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      up.setFiles([
        up.uploadFile({ id: "err-1", key: storageKey, status: "error", error: "boom" }),
      ])

      media.retry(storageKey)

      expect(up.fake.retryFile).toHaveBeenCalledWith("err-1")
      expect(media.persistError()).toBeNull()
    })
  })

  it("is a no-op when no in-flight upload matches the key", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      media.retry(`media/${blipId}/missing`)

      expect(up.fake.retryFile).not.toHaveBeenCalled()
    })
  })
})

describe("mediaStore — reorder", () => {
  it("persists display_order for changed records", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const keyA = `media/${blipId}/a`
      const keyB = `media/${blipId}/b`
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        ensureBlipPersisted: async () => true,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      up.fireSuccess(makeSuccess(blipId, userId, { storageKey: keyA }))
      up.fireSuccess(makeSuccess(blipId, userId, { storageKey: keyB }))
      await vi.waitFor(() => expect(media.records()).toHaveLength(2))

      // Swap order: B first, A second.
      await media.reorder([keyB, keyA])

      // Only the rows whose display_order changed are updated.
      expect(mock.updates.map(update => update.updates.display_order).sort()).toEqual([
        0, 1,
      ])
    })
  })
})

describe("mediaStore — attachments view", () => {
  it("reflects upload progress on fresh attachment objects", async () => {
    await runInRoot(async () => {
      const blipId = uniqueBlip()
      const userId = "user1"
      const storageKey = `media/${userId}/${blipId}/photo`
      const mock = createSupabaseMock()
      const up = makeFakeUpload(blipId, userId)

      const media = mediaStore(mock.client, {
        blipId,
        userId,
        createUploadStore: up.factory,
        r2Service: makeR2(),
      })

      const uploading = up.uploadFile({
        key: storageKey,
        status: "uploading",
        progress: 10,
        previewUrl: "blob:preview",
        processingStatus: "pending",
      })
      up.setFiles([uploading])

      await vi.waitFor(() => {
        expect(media.attachments()[0]?.progress).toBe(10)
      })

      const first = media.attachments()[0]

      up.setFiles([{ ...uploading, progress: 55 }])

      await vi.waitFor(() => {
        expect(media.attachments()[0]?.progress).toBe(55)
      })
      const second = media.attachments()[0]

      expect(second).toBe(first)
    })
  })
})
