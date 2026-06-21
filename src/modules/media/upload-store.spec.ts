import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createUploadStore,
  MAX_FILE_SIZE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  useMultipart,
  type UploadSuccess,
} from "./upload-store"
import type { ProcessMediaResponse } from "./types"
import type { R2Service } from "./r2-service"

/**
 * Minimal fake XMLHttpRequest so the real `@uppy/aws-s3` transport
 * (`uploadPartBytes`) can complete in jsdom without touching the network. It
 * immediately reports progress and a 200 with an `etag` header (the only bits
 * uploadPartBytes reads). This lets us drive the *real* Uppy state machine +
 * our adapter wiring end-to-end. The actual R2/multipart round-trip is proven by
 * the standalone diagnostic scripts.
 */
let etagCounter = 0
class FakeXHR {
  method = ""
  url = ""
  status = 0
  responseText = ""
  responseType = ""
  timeout = 0
  upload = {
    listeners: {} as Record<string, ((ev: unknown) => void)[]>,
    addEventListener(type: string, cb: (ev: unknown) => void) {
      ;(this.listeners[type] ||= []).push(cb)
    },
  }
  listeners: Record<string, ((ev: unknown) => void)[]> = {}
  #etag = `fake-etag-${(etagCounter += 1)}`

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader() {}
  addEventListener(type: string, cb: (ev: unknown) => void) {
    ;(this.listeners[type] ||= []).push(cb)
  }
  getAllResponseHeaders() {
    return `etag: "${this.#etag}"\r\n`
  }
  abort() {
    this.#fire("abort")
  }
  #fireUpload(type: string, ev: unknown) {
    ;(this.upload.listeners[type] ?? []).forEach(cb => cb(ev))
  }
  #fire(type: string, ev: unknown = {}) {
    ;(this.listeners[type] ?? []).forEach(cb => cb(ev))
  }
  send(body?: Blob) {
    const size = body?.size ?? 0
    this.status = 200
    this.responseText = ""
    queueMicrotask(() => {
      this.#fireUpload("progress", {
        loaded: size,
        total: size,
        lengthComputable: true,
      })
      this.#fire("load")
    })
  }
}

const originalXHR = globalThis.XMLHttpRequest

const makeR2 = (): R2Service => ({
  getUploadParameters: vi.fn(async (params: { key: string; contentType: string }) => ({
    method: "PUT" as const,
    url: `https://r2.test/${params.key}`,
    headers: { "Content-Type": params.contentType },
    fields: {} as Record<string, never>,
  })),
  createMultipartUpload: vi.fn(async (params: { key: string }) => ({
    uploadId: "upload-1",
    key: params.key,
  })),
  signPart: vi.fn(async () => "https://r2.test/part"),
  listParts: vi.fn(async () => []),
  completeMultipartUpload: vi.fn(async () => ({ location: "https://r2.test/done" })),
  abortMultipartUpload: vi.fn(async () => {}),
  uploadObject: vi.fn(async () => {}),
  deleteObject: vi.fn(async () => {}),
  getPublicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
})

const variantsFor = (baseKey: string): ProcessMediaResponse["variants"] => ({
  micro: { key: `${baseKey}-micro.webp`, width: 96, height: 64 },
  small: { key: `${baseKey}-small.webp`, width: 200, height: 133 },
  medium: { key: `${baseKey}-medium.webp`, width: 1024, height: 683 },
  large: { key: `${baseKey}-large.webp`, width: 2048, height: 1365 },
})

const imageFile = (name = "photo.jpg") =>
  // Bytes are arbitrary (no EXIF) so naming falls back to `{blipId}-{n}`.
  new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/jpeg" })

beforeEach(() => {
  ;(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
    FakeXHR as unknown as typeof XMLHttpRequest
})

afterEach(() => {
  ;(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
    originalXHR
})

describe("useMultipart threshold", () => {
  it("uses single PUT below 100 MiB and multipart at/above it", () => {
    expect(useMultipart(MULTIPART_THRESHOLD_BYTES - 1)).toBe(false)
    expect(useMultipart(MULTIPART_THRESHOLD_BYTES)).toBe(true)
    expect(useMultipart(MULTIPART_THRESHOLD_BYTES + 1)).toBe(true)
  })

  it("pins the documented thresholds", () => {
    expect(MULTIPART_THRESHOLD_BYTES).toBe(100 * 1024 * 1024)
    expect(MAX_FILE_SIZE_BYTES).toBe(150 * 1024 * 1024)
  })
})

describe("createUploadStore — single-PUT image flow", () => {
  it("uploads, triggers /process, and surfaces variants via onUploadSuccess", async () => {
    const r2 = makeR2()
    const successes: UploadSuccess[] = []
    const processMedia = vi.fn(async (originalKey: string) => {
      const baseKey = originalKey.replace(/-original\.[^.]+$/, "")
      return {
        storageKey: baseKey,
        original: { width: 3000, height: 2000, format: "jpeg" },
        variants: variantsFor(baseKey),
      } satisfies ProcessMediaResponse
    })

    const store = createUploadStore({
      r2Service: r2,
      processMedia,
      onUploadSuccess: s => successes.push(s),
    })

    await store.addFiles([imageFile()], "blip1", "user1")

    // One pending entry with the derived keys, no upload yet.
    expect(store.files()).toHaveLength(1)
    const pending = store.files()[0]
    expect(pending.key).toBe("media/user1/blip1/blip1-1")
    expect(pending.originalKey).toBe("media/user1/blip1/blip1-1-original.jpg")
    expect(pending.status).toBe("pending")
    expect(store.allComplete()).toBe(false)

    await store.startQueue()
    await vi.waitFor(() => expect(successes).toHaveLength(1))

    // Signed via the single-PUT path with the derived original key.
    expect(r2.getUploadParameters).toHaveBeenCalledWith({
      key: "media/user1/blip1/blip1-1-original.jpg",
      contentType: "image/jpeg",
    })
    expect(r2.createMultipartUpload).not.toHaveBeenCalled()

    // /process called with the full original key.
    expect(processMedia).toHaveBeenCalledWith(
      "media/user1/blip1/blip1-1-original.jpg",
    )

    // onUploadSuccess carries everything mediaStore needs to persist a row.
    expect(successes[0]).toMatchObject({
      blipId: "blip1",
      userId: "user1",
      storageKey: "media/user1/blip1/blip1-1",
      originalKey: "media/user1/blip1/blip1-1-original.jpg",
      mediaType: "image",
      mimeType: "image/jpeg",
      processingStatus: "complete",
      width: 3000,
      height: 2000,
    })
    expect(successes[0].variants?.small.key).toBe(
      "media/user1/blip1/blip1-1-small.webp",
    )

    const done = store.files()[0]
    expect(done.status).toBe("complete")
    expect(done.progress).toBe(100)
    expect(store.allComplete()).toBe(true)
    expect(store.hasErrors()).toBe(false)
    expect(store.activeCount()).toBe(0)
  })
})

describe("createUploadStore — video flow", () => {
  const videoFile = () =>
    new File([new Uint8Array([0, 1, 2])], "clip.mp4", { type: "video/mp4" })

  it("never calls /process and uploads the extracted static thumbnail", async () => {
    const r2 = makeR2()
    const processMedia = vi.fn()
    const successes: UploadSuccess[] = []
    const thumbBlob = new Blob([new Uint8Array([9, 9])], { type: "image/webp" })
    const extractThumbnail = vi.fn(async () => ({
      blob: thumbBlob,
      width: 1920,
      height: 1080,
      durationS: 42,
    }))

    const store = createUploadStore({
      r2Service: r2,
      processMedia,
      extractThumbnail,
      onUploadSuccess: s => successes.push(s),
    })

    await store.addFiles([videoFile()], "blip1", "user1")
    await store.startQueue()
    await vi.waitFor(() => expect(successes).toHaveLength(1))

    expect(processMedia).not.toHaveBeenCalled()
    expect(extractThumbnail).toHaveBeenCalled()

    // The static frame is uploaded under the `-thumb.webp` convention.
    expect(r2.uploadObject).toHaveBeenCalledWith({
      key: "media/user1/blip1/blip1-1-thumb.webp",
      body: thumbBlob,
      contentType: "image/webp",
    })

    expect(successes[0]).toMatchObject({
      mediaType: "video",
      processingStatus: "complete",
      storageKey: "media/user1/blip1/blip1-1",
      width: 1920,
      height: 1080,
      durationS: 42,
    })
    expect(successes[0].variants).toBeUndefined()
    expect(store.allComplete()).toBe(true)
  })

  it("still completes when no thumbnail could be extracted", async () => {
    const r2 = makeR2()
    const successes: UploadSuccess[] = []
    const store = createUploadStore({
      r2Service: r2,
      processMedia: vi.fn(),
      extractThumbnail: vi.fn(async () => null),
      onUploadSuccess: s => successes.push(s),
    })

    await store.addFiles([videoFile()], "blip1", "user1")
    await store.startQueue()
    await vi.waitFor(() => expect(successes).toHaveLength(1))

    expect(r2.uploadObject).not.toHaveBeenCalled()
    expect(successes[0]).toMatchObject({
      mediaType: "video",
      processingStatus: "complete",
    })
    expect(successes[0].width).toBeUndefined()
    expect(store.allComplete()).toBe(true)
  })

  it("removes the original + thumbnail from R2 for a completed video", async () => {
    const r2 = makeR2()
    const successes: UploadSuccess[] = []
    const store = createUploadStore({
      r2Service: r2,
      extractThumbnail: vi.fn(async () => ({
        blob: new Blob([new Uint8Array([1])], { type: "image/webp" }),
        width: 640,
        height: 480,
      })),
      onUploadSuccess: s => successes.push(s),
    })

    await store.addFiles([videoFile()], "blip1", "user1")
    await store.startQueue()
    await vi.waitFor(() => expect(successes).toHaveLength(1))

    store.removeFile(store.files()[0].id)

    const deleted = (r2.deleteObject as ReturnType<typeof vi.fn>).mock.calls.map(
      ([key]) => key,
    )
    expect(deleted).toContain("media/user1/blip1/blip1-1-original.mp4")
    expect(deleted).toContain("media/user1/blip1/blip1-1-thumb.webp")
  })
})

describe("createUploadStore — processing failure", () => {
  it("keeps the upload complete but marks processingStatus failed", async () => {
    const r2 = makeR2()
    const processMedia = vi.fn(async () => {
      throw new Error("sharp exploded")
    })
    const successes: UploadSuccess[] = []

    const store = createUploadStore({
      r2Service: r2,
      processMedia,
      onUploadSuccess: s => successes.push(s),
    })

    await store.addFiles([imageFile()], "blip1", "user1")
    await store.startQueue()
    await vi.waitFor(() => expect(successes).toHaveLength(1))

    expect(successes[0].processingStatus).toBe("failed")
    expect(successes[0].variants).toBeUndefined()
    const file = store.files()[0]
    // Upload itself succeeded — must not block publish via hasErrors.
    expect(file.status).toBe("complete")
    expect(file.processingStatus).toBe("failed")
    expect(file.error).toContain("sharp exploded")
    expect(store.hasErrors()).toBe(false)
  })
})

describe("createUploadStore — restrictions", () => {
  it("rejects files over the max size without adding an entry", async () => {
    const r2 = makeR2()
    const store = createUploadStore({ r2Service: r2 })

    const huge = new File([new Uint8Array([0])], "huge.jpg", {
      type: "image/jpeg",
    })
    // Fake an oversized file without allocating the bytes.
    Object.defineProperty(huge, "size", { value: MAX_FILE_SIZE_BYTES + 1 })

    await store.addFiles([huge], "blip1", "user1")

    expect(store.files()).toHaveLength(0)
  })
})

describe("createUploadStore — removeFile", () => {
  it("deletes the original + variants from R2 for a completed upload", async () => {
    const r2 = makeR2()
    const processMedia = vi.fn(async (originalKey: string) => {
      const baseKey = originalKey.replace(/-original\.[^.]+$/, "")
      return {
        storageKey: baseKey,
        original: { width: 100, height: 100, format: "jpeg" },
        variants: variantsFor(baseKey),
      } satisfies ProcessMediaResponse
    })
    const successes: UploadSuccess[] = []

    const store = createUploadStore({
      r2Service: r2,
      processMedia,
      onUploadSuccess: s => successes.push(s),
    })

    await store.addFiles([imageFile()], "blip1", "user1")
    await store.startQueue()
    await vi.waitFor(() => expect(successes).toHaveLength(1))

    const id = store.files()[0].id
    store.removeFile(id)

    const deleted = (r2.deleteObject as ReturnType<typeof vi.fn>).mock.calls.map(
      ([key]) => key,
    )
    expect(deleted).toContain("media/user1/blip1/blip1-1-original.jpg")
    expect(deleted).toContain("media/user1/blip1/blip1-1-micro.webp")
    expect(deleted).toContain("media/user1/blip1/blip1-1-small.webp")
    expect(deleted).toContain("media/user1/blip1/blip1-1-medium.webp")
    expect(deleted).toContain("media/user1/blip1/blip1-1-large.webp")
    expect(store.files()).toHaveLength(0)
  })
})
