import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clipboardReadIsAvailable,
  clipboardSnapshotIsPasteable,
  readClipboardSnapshot,
  snapshotFromClipboardItems,
} from "./clipboard-snapshot"

const originalClipboard = navigator.clipboard

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  })
})

describe("clipboardSnapshotIsPasteable", () => {
  it("treats media or non-empty text as pasteable", () => {
    expect(
      clipboardSnapshotIsPasteable({
        files: [new File(["x"], "shot.png", { type: "image/png" })],
        text: "",
      }),
    ).toBe(true)
    expect(clipboardSnapshotIsPasteable({ files: [], text: " hello " })).toBe(
      true,
    )
    expect(clipboardSnapshotIsPasteable({ files: [], text: "  \n" })).toBe(
      false,
    )
  })
})

describe("readClipboardSnapshot", () => {
  it("returns denied when the clipboard API is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
    expect(clipboardReadIsAvailable()).toBe(false)
    expect(await readClipboardSnapshot()).toEqual({
      files: [],
      text: "",
      denied: true,
    })
  })

  it("does not fall through to readText after read is denied", async () => {
    const clipboard = {
      read: vi.fn(async () => {
        throw new Error("Document is not focused.")
      }),
      readText: vi.fn(async () => "should-not-run"),
    }
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    })

    expect(await readClipboardSnapshot()).toEqual({
      files: [],
      text: "",
      denied: true,
    })
    expect(clipboard.read).toHaveBeenCalledTimes(1)
    expect(clipboard.readText).not.toHaveBeenCalled()
  })

  it("reads image and text clipboard items", async () => {
    const png = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
    const clipboard = {
      read: vi.fn(async () => [
        {
          types: ["image/png"],
          getType: vi.fn(async () => png),
        },
        {
          types: ["text/plain"],
          getType: vi.fn(
            async () => new Blob(["hello"], { type: "text/plain" }),
          ),
        },
      ]),
    }
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    })

    const snapshot = await readClipboardSnapshot()
    expect(snapshot.files).toHaveLength(1)
    expect(snapshot.files[0]?.type).toBe("image/png")
    expect(snapshot.text).toBe("hello")
  })
})

describe("snapshotFromClipboardItems", () => {
  it("pulls a gif out of clipboard HTML when image types are absent", async () => {
    const html = `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`
    const item = {
      types: ["text/html"],
      getType: vi.fn(async (type: string) => {
        if (type === "text/html") {
          return new Blob([html], { type: "text/html" })
        }
        throw new Error(`missing ${type}`)
      }),
    }

    const snapshot = await snapshotFromClipboardItems([
      item as unknown as ClipboardItem,
    ])
    expect(snapshot.files).toHaveLength(1)
    expect(snapshot.files[0]?.type).toBe("image/gif")
  })

  it("does not treat a missing image representation as a denied read", async () => {
    const item = {
      types: ["text/plain"],
      getType: vi.fn(async (type: string) => {
        if (type === "text/plain") {
          return new Blob(["hello"], { type: "text/plain" })
        }
        throw new Error(`missing ${type}`)
      }),
    }

    const snapshot = await snapshotFromClipboardItems([
      item as unknown as ClipboardItem,
    ])
    expect(snapshot).toEqual({ files: [], text: "hello" })
    expect(snapshot.denied).toBeUndefined()
  })
})
