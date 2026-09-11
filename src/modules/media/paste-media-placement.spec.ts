import { describe, expect, it, vi } from "vitest"
import {
  applyPasteMediaPlacement,
  consumeClipboardMediaPaste,
  inspectClipboardMediaPaste,
} from "./paste-media-placement"

const png = () => new File(["x"], "shot.png", { type: "image/png" })

const clipboard = (files: File[], html = ""): DataTransfer =>
  ({
    files,
    items: [],
    getData: (type: string) => (type === "text/html" ? html : ""),
  }) as unknown as DataTransfer

describe("inspectClipboardMediaPaste", () => {
  it("does not prompt when the clipboard has no media files", () => {
    expect(inspectClipboardMediaPaste(null)).toBeNull()
    expect(inspectClipboardMediaPaste(undefined)).toBeNull()
    expect(
      inspectClipboardMediaPaste(
        clipboard([new File(["x"], "note.txt", { type: "text/plain" })]),
      ),
    ).toBeNull()
  })

  it("prompts when the clipboard has media files", () => {
    const file = png()
    const result = inspectClipboardMediaPaste(clipboard([file]))
    expect(result).toEqual({ accepted: [file], rejected: [] })
  })
})

describe("consumeClipboardMediaPaste", () => {
  it("swallows the paste and reports clipboard images", () => {
    const file = png()
    const event = {
      clipboardData: clipboard([file]),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as ClipboardEvent
    const onMedia = vi.fn()

    expect(consumeClipboardMediaPaste(event, onMedia)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(onMedia).toHaveBeenCalledWith({ accepted: [file], rejected: [] })
  })

  it("leaves ordinary text paste alone", () => {
    const event = {
      clipboardData: clipboard([
        new File(["x"], "note.txt", { type: "text/plain" }),
      ]),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as ClipboardEvent

    expect(consumeClipboardMediaPaste(event, vi.fn())).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("claims a paste whose only payload is an image in the markup", async () => {
    const blob = new Blob(["x"], { type: "image/jpeg" })
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ blob: async () => blob } as unknown as Response)
    const event = {
      clipboardData: clipboard([], `<img src="blob:https://site/a">`),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as ClipboardEvent
    const onMedia = vi.fn()

    // iOS hands a copied photo over this way and no other.
    expect(consumeClipboardMediaPaste(event, onMedia)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalled()
    await vi.waitFor(() => expect(onMedia).toHaveBeenCalled())
    expect(onMedia.mock.calls[0][0].accepted[0].type).toBe("image/jpeg")
    fetchSpy.mockRestore()
  })

  it("leaves prose that merely contains images as a text paste", () => {
    const event = {
      clipboardData: clipboard(
        [],
        `<p>read this</p><img src="blob:https://site/a">`,
      ),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as ClipboardEvent

    expect(consumeClipboardMediaPaste(event, vi.fn())).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})

describe("applyPasteMediaPlacement", () => {
  it("inserts embeds after an inline attach", async () => {
    const files = [png()]
    const added = [
      {
        key: "media/u/b/sc-1",
        mediaType: "image" as const,
        mimeType: "image/png",
      },
    ]
    const attach = vi.fn(async () => added)
    const insertMediaEmbeds = vi.fn()

    await applyPasteMediaPlacement({
      placement: "inline",
      files,
      attach,
      insertMediaEmbeds,
    })

    expect(attach).toHaveBeenCalledWith(files, {
      source: "clipboard",
      placement: "inline",
    })
    expect(insertMediaEmbeds).toHaveBeenCalledWith(added)
  })

  it("attaches gallery files without inserting embeds", async () => {
    const files = [png()]
    const attach = vi.fn(async () => [
      {
        key: "media/u/b/sc-1",
        mediaType: "image" as const,
        mimeType: "image/png",
      },
    ])
    const insertMediaEmbeds = vi.fn()

    await applyPasteMediaPlacement({
      placement: "gallery",
      files,
      attach,
      insertMediaEmbeds,
    })

    expect(attach).toHaveBeenCalledWith(files, {
      source: "clipboard",
      placement: "gallery",
    })
    expect(insertMediaEmbeds).not.toHaveBeenCalled()
  })

  it("does neither when the paste prompt is dismissed", () => {
    const attach = vi.fn()
    const insertMediaEmbeds = vi.fn()
    const inspected = inspectClipboardMediaPaste(clipboard([png()]))

    expect(inspected?.accepted).toHaveLength(1)
    // Escape / Cancel drops the pending files and never calls apply.
    expect(attach).not.toHaveBeenCalled()
    expect(insertMediaEmbeds).not.toHaveBeenCalled()
  })
})
