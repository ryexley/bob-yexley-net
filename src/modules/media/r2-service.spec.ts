import { afterEach, describe, expect, it, vi } from "vitest"
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
})
