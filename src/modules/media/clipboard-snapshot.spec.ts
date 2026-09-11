import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clipboardReadIsAvailable,
  clipboardSnapshotIsPasteable,
  readClipboardSnapshot,
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
  it("returns empty when the clipboard API is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
    expect(clipboardReadIsAvailable()).toBe(false)
    expect(await readClipboardSnapshot()).toEqual({ files: [], text: "" })
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
