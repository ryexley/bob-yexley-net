/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest"

// Configurable auth result for the mocked Supabase server client.
let mockUser: { id: string } | null = { id: "user-1" }
let mockUserError: unknown = null

// Hoisted so the module-mock factories can reference them.
const { mockSend, mockProcessImage } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockProcessImage: vi.fn(),
}))

vi.mock("@/lib/vendor/supabase/server", () => ({
  getServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUserError,
      }),
    },
  }),
}))

// Vite's default `browser` export condition resolves @aws-sdk/core to a
// broken browser build. Mock the SDK here; the real signing path is covered
// by scripts/r2-presign-check.mjs against live R2.
vi.mock("@/lib/vendor/r2/client", () => ({
  getR2Client: () => ({ send: mockSend }),
  getR2Config: () => ({
    bucket: "yexley-media",
    endpoint: "https://acct.r2.cloudflarestorage.com",
    accessKeyId: "test-access-key-id",
    secretAccessKey: "test-secret-access-key",
  }),
}))

vi.mock("@aws-sdk/client-s3", () => {
  class FakeCommand {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) {
      this.input = input
    }
  }

  return {
    AbortMultipartUploadCommand: class AbortMultipartUploadCommand extends FakeCommand {},
    CompleteMultipartUploadCommand: class CompleteMultipartUploadCommand extends FakeCommand {},
    CreateMultipartUploadCommand: class CreateMultipartUploadCommand extends FakeCommand {},
    DeleteObjectCommand: class DeleteObjectCommand extends FakeCommand {},
    GetObjectCommand: class GetObjectCommand extends FakeCommand {},
    ListPartsCommand: class ListPartsCommand extends FakeCommand {},
    PutObjectCommand: class PutObjectCommand extends FakeCommand {},
    UploadPartCommand: class UploadPartCommand extends FakeCommand {},
  }
})

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async (_client: unknown, command: { input: { Key: string } }) =>
    `https://signed.example/${command.input.Key}?X-Amz-Signature=test`,
}))

// The real sharp transform is covered by process.spec.ts and the standalone
// scripts/media-process-check.mjs. Here we isolate the server's fetch/derive/
// upload wiring from libvips.
vi.mock("./process", () => ({ processImage: mockProcessImage }))

import {
  abortMultipart,
  completeMultipart,
  createMultipart,
  deleteObject,
  listParts,
  processMedia,
  resultResponse,
  signPart,
  signUpload,
} from "./server"

describe("media server — signUpload", () => {
  beforeEach(() => {
    mockUser = { id: "user-1" }
    mockUserError = null
  })

  it("returns a presigned PUT URL for a key in the user's namespace", async () => {
    const result = await signUpload({
      key: "media/user-1/blip-1/20240815143022",
      contentType: "image/jpeg",
    })

    expect(result.status).toBe(200)
    expect(result.error).toBeNull()
    expect(result.data?.method).toBe("PUT")
    expect(result.data?.headers["Content-Type"]).toBe("image/jpeg")
    // Presigned URL should target the bucket + key and carry a SigV4 signature.
    expect(result.data?.url).toContain("media/user-1/blip-1/20240815143022")
    expect(result.data?.url).toContain("X-Amz-Signature")
  })

  it("rejects a key outside the user's namespace with 403", async () => {
    const result = await signUpload({
      key: "media/someone-else/blip-1/file",
      contentType: "image/jpeg",
    })

    expect(result.status).toBe(403)
    expect(result.data).toBeNull()
  })

  it("rejects unauthenticated requests with 401", async () => {
    mockUser = null

    const result = await signUpload({
      key: "media/user-1/blip-1/file",
      contentType: "image/jpeg",
    })

    expect(result.status).toBe(401)
    expect(result.data).toBeNull()
  })

  it("rejects an invalid payload with 400", async () => {
    const result = await signUpload({ key: "", contentType: "" })

    expect(result.status).toBe(400)
    expect(result.data).toBeNull()
  })
})

describe("media server — processMedia", () => {
  beforeEach(() => {
    mockUser = { id: "user-1" }
    mockUserError = null

    mockSend.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === "GetObjectCommand") {
          return {
            Body: {
              transformToByteArray: async () => new Uint8Array([1, 2, 3]),
            },
          }
        }
        return {}
      },
    )

    mockProcessImage.mockResolvedValue({
      original: { width: 3000, height: 2000, format: "jpeg" },
      variants: [
        {
          variant: "micro",
          data: Buffer.from("x"),
          width: 96,
          height: 64,
          contentType: "image/webp",
        },
        {
          variant: "small",
          data: Buffer.from("s"),
          width: 200,
          height: 133,
          contentType: "image/webp",
        },
        {
          variant: "medium",
          data: Buffer.from("m"),
          width: 1024,
          height: 683,
          contentType: "image/webp",
        },
        {
          variant: "large",
          data: Buffer.from("l"),
          width: 2048,
          height: 1365,
          contentType: "image/webp",
        },
      ],
    })
  })

  it("fetches the original, generates variants, and returns derived keys", async () => {
    const result = await processMedia({
      key: "media/user-1/blip-1/20240815143022-original.jpg",
    })

    expect(result.status).toBe(200)
    expect(result.error).toBeNull()
    expect(result.data?.storageKey).toBe("media/user-1/blip-1/20240815143022")
    expect(result.data?.original).toEqual({
      width: 3000,
      height: 2000,
      format: "jpeg",
    })
    expect(result.data?.variants.micro).toEqual({
      key: "media/user-1/blip-1/20240815143022-micro.webp",
      width: 96,
      height: 64,
    })
    expect(result.data?.variants.small).toEqual({
      key: "media/user-1/blip-1/20240815143022-small.webp",
      width: 200,
      height: 133,
    })
    expect(result.data?.variants.medium.key).toBe(
      "media/user-1/blip-1/20240815143022-medium.webp",
    )
    expect(result.data?.variants.large.key).toBe(
      "media/user-1/blip-1/20240815143022-large.webp",
    )

    // One GetObject for the original + one PutObject per variant.
    const sentCommands = mockSend.mock.calls.map(([c]) => c.constructor.name)
    expect(sentCommands.filter(n => n === "GetObjectCommand")).toHaveLength(1)
    expect(sentCommands.filter(n => n === "PutObjectCommand")).toHaveLength(4)
  })

  it("rejects a key outside the user's namespace with 403", async () => {
    const result = await processMedia({
      key: "media/someone-else/blip-1/file-original.jpg",
    })

    expect(result.status).toBe(403)
    expect(result.data).toBeNull()
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated requests with 401", async () => {
    mockUser = null

    const result = await processMedia({
      key: "media/user-1/blip-1/file-original.jpg",
    })

    expect(result.status).toBe(401)
    expect(result.data).toBeNull()
  })

  it("rejects a key that is not an -original.<ext> object with 400", async () => {
    const result = await processMedia({ key: "media/user-1/blip-1/file.jpg" })

    expect(result.status).toBe(400)
    expect(result.data).toBeNull()
    expect(mockProcessImage).not.toHaveBeenCalled()
  })

  it("rejects an invalid payload with 400", async () => {
    const result = await processMedia({ key: "" })

    expect(result.status).toBe(400)
    expect(result.data).toBeNull()
  })
})

describe("media server — resultResponse", () => {
  it("serializes a result with its status and JSON content type", async () => {
    const response = resultResponse({
      data: { ok: true },
      error: null,
      status: 200,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/json")
    await expect(response.json()).resolves.toEqual({
      data: { ok: true },
      error: null,
      status: 200,
    })
  })

  it("carries a failure status through to the HTTP response", async () => {
    const response = resultResponse({
      data: null,
      error: "Forbidden: key is outside your namespace",
      status: 403,
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ status: 403 })
  })
})

/**
 * The multipart routes carry videos over the 100 MiB single-PUT threshold.
 * Every one of them runs the same authorize gate, so each is checked for the
 * namespace escape as well as its happy path — a missing check here would let
 * one user write objects into another user's prefix.
 */
describe("media server — multipart upload routes", () => {
  beforeEach(() => {
    mockUser = { id: "user-1" }
    mockUserError = null
    mockSend.mockReset()
  })

  const key = "media/user-1/blip-1/clip-original.mp4"
  const foreignKey = "media/someone-else/blip-1/clip-original.mp4"

  describe("createMultipart", () => {
    it("starts the upload and returns R2's upload id", async () => {
      mockSend.mockResolvedValue({ UploadId: "upload-abc" })

      const result = await createMultipart({ key, contentType: "video/mp4" })

      expect(result.status).toBe(200)
      expect(result.data).toEqual({ uploadId: "upload-abc", key })
      expect(mockSend.mock.calls[0][0].input).toMatchObject({
        Bucket: "yexley-media",
        Key: key,
        ContentType: "video/mp4",
      })
    })

    it("fails when R2 returns no upload id", async () => {
      mockSend.mockResolvedValue({})

      const result = await createMultipart({ key, contentType: "video/mp4" })

      expect(result.status).toBe(500)
      expect(result.data).toBeNull()
    })

    it("reports a 500 when R2 throws", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      mockSend.mockRejectedValue(new Error("r2 down"))

      const result = await createMultipart({ key, contentType: "video/mp4" })

      expect(result.status).toBe(500)
      // The SDK error text never reaches the client.
      expect(result.error).toBe("Unable to start multipart upload")
      error.mockRestore()
    })

    it("rejects a key outside the user's namespace", async () => {
      const result = await createMultipart({
        key: foreignKey,
        contentType: "video/mp4",
      })

      expect(result.status).toBe(403)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it("rejects an unauthenticated request", async () => {
      mockUser = null

      const result = await createMultipart({ key, contentType: "video/mp4" })

      expect(result.status).toBe(401)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it("rejects an invalid payload", async () => {
      expect((await createMultipart({ key: "", contentType: "" })).status).toBe(
        400,
      )
    })
  })

  describe("signPart", () => {
    it("signs the requested part", async () => {
      const result = await signPart({
        key,
        uploadId: "upload-abc",
        partNumber: 3,
      })

      expect(result.status).toBe(200)
      expect(result.data?.url).toContain(key)
      expect(result.data?.url).toContain("X-Amz-Signature")
    })

    it("rejects a key outside the user's namespace", async () => {
      const result = await signPart({
        key: foreignKey,
        uploadId: "upload-abc",
        partNumber: 1,
      })

      expect(result.status).toBe(403)
    })

    it("rejects a part number outside the S3 range", async () => {
      expect(
        (await signPart({ key, uploadId: "u", partNumber: 0 })).status,
      ).toBe(400)
      expect(
        (await signPart({ key, uploadId: "u", partNumber: 10_001 })).status,
      ).toBe(400)
    })

    it("rejects a missing upload id", async () => {
      expect(
        (await signPart({ key, uploadId: "", partNumber: 1 })).status,
      ).toBe(400)
    })
  })

  describe("listParts", () => {
    it("returns the parts already stored, for resuming an upload", async () => {
      mockSend.mockResolvedValue({
        Parts: [
          { PartNumber: 1, ETag: "etag-1" },
          { PartNumber: 2, ETag: "etag-2" },
        ],
      })

      const result = await listParts({ key, uploadId: "upload-abc" })

      expect(result.status).toBe(200)
      expect(result.data?.parts).toEqual([
        { PartNumber: 1, ETag: "etag-1" },
        { PartNumber: 2, ETag: "etag-2" },
      ])
    })

    it("drops incomplete part records R2 may include", async () => {
      mockSend.mockResolvedValue({
        Parts: [
          { PartNumber: 1, ETag: "etag-1" },
          { PartNumber: 2 },
          { ETag: "etag-3" },
        ],
      })

      const result = await listParts({ key, uploadId: "upload-abc" })

      expect(result.data?.parts).toEqual([{ PartNumber: 1, ETag: "etag-1" }])
    })

    it("returns an empty list when no parts have landed", async () => {
      mockSend.mockResolvedValue({})

      const result = await listParts({ key, uploadId: "upload-abc" })

      expect(result.data?.parts).toEqual([])
    })

    it("reports a 500 when R2 throws", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      mockSend.mockRejectedValue(new Error("r2 down"))

      expect((await listParts({ key, uploadId: "u" })).status).toBe(500)
      error.mockRestore()
    })

    it("rejects a key outside the user's namespace", async () => {
      expect((await listParts({ key: foreignKey, uploadId: "u" })).status).toBe(
        403,
      )
    })
  })

  describe("completeMultipart", () => {
    it("sorts the parts before completing, as S3 requires", async () => {
      mockSend.mockResolvedValue({ Location: "https://r2.test/clip" })

      const result = await completeMultipart({
        key,
        uploadId: "upload-abc",
        parts: [
          { PartNumber: 3, ETag: "etag-3" },
          { PartNumber: 1, ETag: "etag-1" },
          { PartNumber: 2, ETag: "etag-2" },
        ],
      })

      expect(result.status).toBe(200)
      expect(result.data?.location).toBe("https://r2.test/clip")
      // Out-of-order parts make R2 reject the whole upload.
      expect(mockSend.mock.calls[0][0].input.MultipartUpload.Parts).toEqual([
        { PartNumber: 1, ETag: "etag-1" },
        { PartNumber: 2, ETag: "etag-2" },
        { PartNumber: 3, ETag: "etag-3" },
      ])
    })

    it("rejects a completion with no parts", async () => {
      const result = await completeMultipart({
        key,
        uploadId: "upload-abc",
        parts: [],
      })

      expect(result.status).toBe(400)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it("rejects a part missing its ETag", async () => {
      const result = await completeMultipart({
        key,
        uploadId: "upload-abc",
        parts: [{ PartNumber: 1, ETag: "" }],
      })

      expect(result.status).toBe(400)
    })

    it("reports a 500 when R2 throws", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      mockSend.mockRejectedValue(new Error("r2 down"))

      const result = await completeMultipart({
        key,
        uploadId: "u",
        parts: [{ PartNumber: 1, ETag: "etag-1" }],
      })

      expect(result.status).toBe(500)
      error.mockRestore()
    })

    it("rejects a key outside the user's namespace", async () => {
      const result = await completeMultipart({
        key: foreignKey,
        uploadId: "u",
        parts: [{ PartNumber: 1, ETag: "etag-1" }],
      })

      expect(result.status).toBe(403)
    })
  })

  describe("abortMultipart", () => {
    it("aborts the upload so R2 stops billing for orphaned parts", async () => {
      mockSend.mockResolvedValue({})

      const result = await abortMultipart({ key, uploadId: "upload-abc" })

      expect(result.status).toBe(200)
      expect(result.data).toEqual({ aborted: true })
      expect(mockSend.mock.calls[0][0].input).toMatchObject({
        Bucket: "yexley-media",
        Key: key,
        UploadId: "upload-abc",
      })
    })

    it("reports a 500 when R2 throws", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      mockSend.mockRejectedValue(new Error("r2 down"))

      expect((await abortMultipart({ key, uploadId: "u" })).status).toBe(500)
      error.mockRestore()
    })

    it("rejects a key outside the user's namespace", async () => {
      expect(
        (await abortMultipart({ key: foreignKey, uploadId: "u" })).status,
      ).toBe(403)
    })
  })
})

describe("media server — deleteObject", () => {
  beforeEach(() => {
    mockUser = { id: "user-1" }
    mockUserError = null
    mockSend.mockReset()
  })

  it("deletes a key in the user's namespace", async () => {
    mockSend.mockResolvedValue({})

    const result = await deleteObject({
      key: "media/user-1/blip-1/photo-original.jpg",
    })

    expect(result.status).toBe(200)
    expect(result.data).toEqual({ deleted: true })
    expect(mockSend.mock.calls[0][0].input).toMatchObject({
      Bucket: "yexley-media",
      Key: "media/user-1/blip-1/photo-original.jpg",
    })
  })

  it("refuses to delete another user's object", async () => {
    const result = await deleteObject({
      key: "media/someone-else/blip-1/photo-original.jpg",
    })

    expect(result.status).toBe(403)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("refuses a near-miss prefix that is not the user's namespace", async () => {
    // `media/user-10/...` must not satisfy a `media/user-1` ownership check.
    const result = await deleteObject({
      key: "media/user-10/blip-1/photo-original.jpg",
    })

    expect(result.status).toBe(403)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated request", async () => {
    mockUser = null

    expect((await deleteObject({ key: "media/user-1/blip-1/x" })).status).toBe(
      401,
    )
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("reports a 500 when R2 throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    mockSend.mockRejectedValue(new Error("r2 down"))

    const result = await deleteObject({ key: "media/user-1/blip-1/x" })

    expect(result.status).toBe(500)
    expect(result.error).toBe("Unable to delete object")
    error.mockRestore()
  })

  it("rejects an empty key", async () => {
    expect((await deleteObject({ key: "" })).status).toBe(400)
  })

  it("rejects a key beyond the length limit", async () => {
    expect((await deleteObject({ key: "a".repeat(1025) })).status).toBe(400)
  })
})

describe("media server — auth failures", () => {
  beforeEach(() => {
    mockUser = { id: "user-1" }
    mockUserError = null
    mockSend.mockReset()
  })

  it("treats a Supabase auth error as unauthorized", async () => {
    mockUser = null
    mockUserError = { message: "jwt expired" }

    const result = await signUpload({
      key: "media/user-1/blip-1/file",
      contentType: "image/jpeg",
    })

    expect(result.status).toBe(401)
    expect(result.data).toBeNull()
  })
})
