import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { r2Service } from "./r2-service"

describe("r2Service.getPublicUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("joins the storage base URL and key with a single slash", () => {
    vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://pub-abc.r2.dev")
    expect(r2Service.getPublicUrl("media/user-1/blip-1/file-small.webp")).toBe(
      "https://pub-abc.r2.dev/media/user-1/blip-1/file-small.webp",
    )
  })

  it("normalizes trailing/leading slashes", () => {
    vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://pub-abc.r2.dev/")
    expect(r2Service.getPublicUrl("/media/user-1/file.webp")).toBe(
      "https://pub-abc.r2.dev/media/user-1/file.webp",
    )
  })

  it("warns rather than throwing when the base URL is unconfigured", () => {
    vi.stubEnv("VITE_MEDIA_STORAGE_URL", "")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(r2Service.getPublicUrl("media/a.webp")).toBe("/media/a.webp")
    expect(warn).toHaveBeenCalled()
  })
})

/**
 * Every mutating R2 call goes through one `request` helper, so its envelope
 * handling decides whether a server-side failure reaches the author as
 * something actionable or as a silent no-op. These endpoints are the shared
 * transport for both the rail and the inline-paste path.
 */
describe("r2Service — request envelope", () => {
  const fetchMock = vi.fn()

  const respond = (
    body: unknown,
    init: { ok?: boolean; status?: number } = {},
  ) => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  })

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts the params as JSON with same-origin credentials", async () => {
    fetchMock.mockResolvedValue(
      respond({
        data: { method: "PUT", url: "https://r2.test/obj", headers: {} },
      }),
    )

    await r2Service.getUploadParameters({
      key: "media/user-1/blip-1/photo-original.jpg",
      contentType: "image/jpeg",
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("/api/media/sign")
    expect(init.method).toBe("POST")
    // The routes authenticate via the session cookie; dropping this would make
    // every signing call unauthorized.
    expect(init.credentials).toBe("same-origin")
    expect(init.headers).toMatchObject({ "content-type": "application/json" })
    expect(JSON.parse(init.body)).toEqual({
      key: "media/user-1/blip-1/photo-original.jpg",
      contentType: "image/jpeg",
    })
  })

  it("surfaces the server's error message from a 200 envelope", async () => {
    fetchMock.mockResolvedValue(respond({ error: "R2 bucket not configured" }))

    await expect(
      r2Service.getUploadParameters({ key: "k", contentType: "image/jpeg" }),
    ).rejects.toThrow("R2 bucket not configured")
  })

  it("surfaces the server's error message from a failed status", async () => {
    fetchMock.mockResolvedValue(
      respond({ error: "Not signed in" }, { ok: false, status: 401 }),
    )

    await expect(
      r2Service.getUploadParameters({ key: "k", contentType: "image/jpeg" }),
    ).rejects.toThrow("Not signed in")
  })

  it("falls back to the status code when the body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json")
      },
    })

    await expect(
      r2Service.getUploadParameters({ key: "k", contentType: "image/jpeg" }),
    ).rejects.toThrow("/api/media/sign failed (502)")
  })

  it("rejects a success envelope carrying no data", async () => {
    fetchMock.mockResolvedValue(respond({ data: null }))

    await expect(
      r2Service.getUploadParameters({ key: "k", contentType: "image/jpeg" }),
    ).rejects.toThrow(/failed \(200\)/)
  })
})

describe("r2Service — endpoint wiring", () => {
  const fetchMock = vi.fn()

  const ok = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => ({ data }),
  })

  const bodyOf = (callIndex: number) =>
    JSON.parse(fetchMock.mock.calls[callIndex]![1].body)

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("adds the empty fields map Uppy's S3 plugin expects", async () => {
    fetchMock.mockResolvedValue(
      ok({ method: "PUT", url: "https://r2.test/obj", headers: { a: "b" } }),
    )

    const signed = await r2Service.getUploadParameters({
      key: "k",
      contentType: "image/jpeg",
    })

    expect(signed).toEqual({
      method: "PUT",
      url: "https://r2.test/obj",
      headers: { a: "b" },
      fields: {},
    })
  })

  it("creates a multipart upload", async () => {
    fetchMock.mockResolvedValue(ok({ uploadId: "u-1", key: "k" }))

    await expect(
      r2Service.createMultipartUpload({ key: "k", contentType: "video/mp4" }),
    ).resolves.toEqual({ uploadId: "u-1", key: "k" })
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/media/multipart/create")
  })

  it("unwraps the signed part URL", async () => {
    fetchMock.mockResolvedValue(ok({ url: "https://r2.test/part-3" }))

    await expect(
      r2Service.signPart({ key: "k", uploadId: "u-1", partNumber: 3 }),
    ).resolves.toBe("https://r2.test/part-3")
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/media/multipart/sign-part")
    expect(bodyOf(0)).toEqual({ key: "k", uploadId: "u-1", partNumber: 3 })
  })

  it("unwraps the parts list used to resume an interrupted upload", async () => {
    const parts = [{ PartNumber: 1, ETag: "etag-1" }]
    fetchMock.mockResolvedValue(ok({ parts }))

    await expect(
      r2Service.listParts({ key: "k", uploadId: "u-1" }),
    ).resolves.toEqual(parts)
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/media/multipart/list-parts")
  })

  it("completes a multipart upload with the assembled parts", async () => {
    fetchMock.mockResolvedValue(ok({ location: "https://r2.test/done" }))
    const parts = [{ PartNumber: 1, ETag: "etag-1" }]

    await r2Service.completeMultipartUpload({
      key: "k",
      uploadId: "u-1",
      parts,
    })

    expect(fetchMock.mock.calls[0]![0]).toBe("/api/media/multipart/complete")
    expect(bodyOf(0)).toEqual({ key: "k", uploadId: "u-1", parts })
  })

  it("aborts a multipart upload", async () => {
    fetchMock.mockResolvedValue(ok({ aborted: true }))

    await r2Service.abortMultipartUpload({ key: "k", uploadId: "u-1" })

    expect(fetchMock.mock.calls[0]![0]).toBe("/api/media/multipart/abort")
  })

  it("deletes an object by key", async () => {
    fetchMock.mockResolvedValue(ok({ deleted: true }))

    await r2Service.deleteObject("media/user-1/blip-1/photo-original.jpg")

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("/api/media/object")
    expect(init.method).toBe("DELETE")
    expect(JSON.parse(init.body)).toEqual({
      key: "media/user-1/blip-1/photo-original.jpg",
    })
  })
})

/**
 * The client-extracted video/GIF thumbnail is the one object the browser PUTs
 * to R2 itself, so it signs first and then uploads to the returned URL.
 */
describe("r2Service.uploadObject", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("signs for the thumbnail key, then PUTs the body to the signed URL", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            method: "PUT",
            url: "https://r2.test/thumb",
            headers: { "Content-Type": "image/webp" },
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    const body = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" })
    await r2Service.uploadObject({
      key: "media/user-1/blip-1/clip-thumb.webp",
      body,
      contentType: "image/webp",
    })

    expect(fetchMock.mock.calls[0]![0]).toBe("/api/media/sign")
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      key: "media/user-1/blip-1/clip-thumb.webp",
      contentType: "image/webp",
    })

    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("https://r2.test/thumb")
    expect(init.method).toBe("PUT")
    expect(init.body).toBe(body)
  })

  it("throws when R2 rejects the PUT", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { method: "PUT", url: "https://r2.test/thumb", headers: {} },
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 })

    await expect(
      r2Service.uploadObject({
        key: "k",
        body: new Blob(["x"]),
        contentType: "image/webp",
      }),
    ).rejects.toThrow("Upload to R2 failed (403)")
  })
})
