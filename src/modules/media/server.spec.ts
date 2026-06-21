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

// The AWS SDK's S3Client + SigV4 presigner do not initialize cleanly under the
// jsdom test environment. The real signing path is verified separately by
// scripts/r2-presign-check.mjs against live R2. Here we mock the R2 client +
// presigner so the test isolates the server's auth, ownership, validation, and
// wiring logic, asserting the correct key + content type flow through.
vi.mock("@/lib/vendor/r2/client", () => ({
  getR2Client: () => ({ send: mockSend }),
  getR2Config: () => ({
    bucket: "yexley-media",
    endpoint: "https://acct.r2.cloudflarestorage.com",
    accessKeyId: "test-access-key-id",
    secretAccessKey: "test-secret-access-key",
  }),
}))

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async (_client: unknown, command: { input: { Key: string } }) =>
    `https://signed.example/${command.input.Key}?X-Amz-Signature=test`,
}))

// The real sharp transform is covered by process.spec.ts and the standalone
// scripts/media-process-check.mjs. Here we isolate the server's fetch/derive/
// upload wiring from libvips.
vi.mock("./process", () => ({ processImage: mockProcessImage }))

import { processMedia, signUpload } from "./server"

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

    mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetObjectCommand") {
        return {
          Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
        }
      }
      return {}
    })

    mockProcessImage.mockResolvedValue({
      original: { width: 3000, height: 2000, format: "jpeg" },
      variants: [
        { variant: "micro", data: Buffer.from("x"), width: 96, height: 64, contentType: "image/webp" },
        { variant: "small", data: Buffer.from("s"), width: 200, height: 133, contentType: "image/webp" },
        { variant: "medium", data: Buffer.from("m"), width: 1024, height: 683, contentType: "image/webp" },
        { variant: "large", data: Buffer.from("l"), width: 2048, height: 1365, contentType: "image/webp" },
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
    expect(result.data?.original).toEqual({ width: 3000, height: 2000, format: "jpeg" })
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
