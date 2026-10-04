import { describe, expect, it } from "vitest"
import { buildTagCoverKey } from "./tag-cover-upload"

describe("buildTagCoverKey", () => {
  it("namespaces the key under the user's media prefix", () => {
    const key = buildTagCoverKey(
      "user-1",
      "faith",
      "image/jpeg",
      new Date("2026-10-04T21:42:52.123Z"),
    )
    expect(key).toBe("media/user-1/tags/faith-20261004214252.jpg")
  })

  it("sanitizes the tag name and maps the extension from the mime type", () => {
    const key = buildTagCoverKey(
      "u",
      "Weird Name!",
      "image/webp",
      new Date("2026-01-02T03:04:05Z"),
    )
    expect(key).toBe("media/u/tags/weird-name-20260102030405.webp")
  })
})
