import { describe, expect, it } from "vitest"
import { MAX_FILE_SIZE_BYTES } from "./upload-store"
import {
  clipboardMediaFiles,
  isClipboardMediaFile,
  validateMediaFiles,
} from "./file-validation"

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

describe("clipboardMediaFiles", () => {
  it("accepts images, gifs, and videos from the files list", () => {
    const png = fileOfSize("shot.png", "image/png", 10)
    const gif = fileOfSize("loop.gif", "image/gif", 10)
    const mp4 = fileOfSize("clip.mp4", "video/mp4", 10)
    const txt = fileOfSize("note.txt", "text/plain", 10)

    expect(isClipboardMediaFile(png)).toBe(true)
    expect(isClipboardMediaFile(gif)).toBe(true)
    expect(isClipboardMediaFile(mp4)).toBe(true)
    expect(isClipboardMediaFile(txt)).toBe(false)

    const data = {
      files: [png, gif, mp4, txt],
      items: [],
    } as unknown as DataTransfer

    expect(clipboardMediaFiles(data)).toEqual([png, gif, mp4])
  })

  it("falls back to items when files is empty", () => {
    const png = fileOfSize("shot.png", "image/png", 10)
    const data = {
      files: [],
      items: [
        {
          kind: "file",
          getAsFile: () => png,
        },
        {
          kind: "string",
          getAsFile: () => null,
        },
      ],
    } as unknown as DataTransfer

    expect(clipboardMediaFiles(data)).toEqual([png])
  })

  it("returns [] when there is no clipboard data", () => {
    expect(clipboardMediaFiles(null)).toEqual([])
    expect(clipboardMediaFiles(undefined)).toEqual([])
  })
})
