import { describe, expect, it } from "vitest"
import { MAX_FILE_SIZE_BYTES } from "./upload-store"
import { validateMediaFiles } from "./file-validation"

const fileOfSize = (name: string, type: string, size: number): File => {
  const file = new File(["x"], name, { type })
  Object.defineProperty(file, "size", { value: size })
  return file
}

describe("validateMediaFiles", () => {
  it("accepts files with an allowed mime type", () => {
    const jpeg = fileOfSize("photo.jpg", "image/jpeg", 1024)
    const mp4 = fileOfSize("clip.mp4", "video/mp4", 1024)

    const result = validateMediaFiles([jpeg, mp4])

    expect(result.accepted).toEqual([jpeg, mp4])
    expect(result.rejected).toEqual([])
  })

  it("accepts by extension when the mime type is missing", () => {
    const heic = fileOfSize("IMG_0001.HEIC", "", 1024)

    const result = validateMediaFiles([heic])

    expect(result.accepted).toEqual([heic])
  })

  it("rejects unsupported types", () => {
    const pdf = fileOfSize("doc.pdf", "application/pdf", 1024)

    const result = validateMediaFiles([pdf])

    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ file: pdf, reason: "type" }])
  })

  it("rejects files over the size ceiling", () => {
    const huge = fileOfSize("big.jpg", "image/jpeg", MAX_FILE_SIZE_BYTES + 1)

    const result = validateMediaFiles([huge])

    expect(result.rejected).toEqual([{ file: huge, reason: "size" }])
  })

  it("partitions a mixed batch", () => {
    const ok = fileOfSize("ok.png", "image/png", 1024)
    const badType = fileOfSize("bad.txt", "text/plain", 1024)
    const tooBig = fileOfSize("big.webp", "image/webp", MAX_FILE_SIZE_BYTES + 1)

    const result = validateMediaFiles([ok, badType, tooBig])

    expect(result.accepted).toEqual([ok])
    expect(result.rejected.map(entry => entry.reason)).toEqual(["type", "size"])
  })
})
