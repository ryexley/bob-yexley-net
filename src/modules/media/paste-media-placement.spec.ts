import { describe, expect, it, vi } from "vitest"
import {
  applyPasteMediaPlacement,
  consumeClipboardMediaPaste,
  inspectClipboardMediaPaste,
  readClipboardMediaFiles,
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

  it("claims the paste but reports nothing when the harvest comes up empty", async () => {
    // iOS marks the clipboard as holding an image, but the blob URL is already
    // dead by the time it is fetched. The paste is still swallowed (the default
    // insert would drop a broken image into the document), and the prompt must
    // not open for zero files.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("blob revoked"))
    const event = {
      clipboardData: clipboard([], `<img src="blob:https://site/gone">`),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as ClipboardEvent
    const onMedia = vi.fn()

    expect(consumeClipboardMediaPaste(event, onMedia)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalled()

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(onMedia).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

/**
 * The last-resort read for iOS Safari, where a pasted photo reaches neither
 * `clipboardData.files` nor the markup. Async `navigator.clipboard.read()` is
 * the only remaining source, and it is also the one most likely to be blocked
 * or unavailable — so each outcome has to degrade to an empty list rather than
 * throwing out of the paste handler.
 */
describe("readClipboardMediaFiles", () => {
  const withClipboard = (value: unknown) => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis.navigator,
      "clipboard",
    )
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value,
      configurable: true,
    })
    return () => {
      if (original) {
        Object.defineProperty(globalThis.navigator, "clipboard", original)
      } else {
        delete (globalThis.navigator as unknown as Record<string, unknown>)
          .clipboard
      }
    }
  }

  it("returns the synchronous files without any async read", async () => {
    const file = png()
    const restore = withClipboard({ read: vi.fn() })

    await expect(readClipboardMediaFiles(clipboard([file]))).resolves.toEqual([
      file,
    ])
    expect(globalThis.navigator.clipboard.read).not.toHaveBeenCalled()
    restore()
  })

  it("harvests the markup before reaching for the async clipboard", async () => {
    const blob = new Blob(["x"], { type: "image/jpeg" })
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ blob: async () => blob } as unknown as Response)
    const read = vi.fn()
    const restore = withClipboard({ read })

    const files = await readClipboardMediaFiles(
      clipboard([]),
      `<img src="blob:https://site/a">`,
    )

    expect(files).toHaveLength(1)
    expect(files[0].type).toBe("image/jpeg")
    expect(read).not.toHaveBeenCalled()
    restore()
    fetchSpy.mockRestore()
  })

  it("falls back to the async clipboard when nothing else carries the photo", async () => {
    const blob = new Blob(["x"], { type: "image/png" })
    const restore = withClipboard({
      read: vi.fn(async () => [
        {
          types: ["image/png"],
          getType: async () => blob,
        },
      ]),
    })

    const files = await readClipboardMediaFiles(clipboard([]))

    expect(files).toHaveLength(1)
    expect(files[0].type).toBe("image/png")
    restore()
  })

  it("returns nothing when the browser exposes no async clipboard read", async () => {
    const restore = withClipboard({})

    await expect(readClipboardMediaFiles(clipboard([]))).resolves.toEqual([])
    restore()
  })

  it("returns nothing when the async read is denied", async () => {
    // Safari rejects this unless the read happens inside a user gesture.
    const restore = withClipboard({
      read: vi.fn(async () => {
        throw new Error("NotAllowedError")
      }),
    })

    await expect(readClipboardMediaFiles(clipboard([]))).resolves.toEqual([])
    restore()
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
