import { afterEach, describe, expect, it, vi } from "vitest"

const jpeg = () =>
  new File([new Uint8Array([1, 2, 3])], "p.jpg", { type: "image/jpeg" })

describe("readImageDisplaySize", () => {
  it("returns null when the file cannot be decoded as an image", async () => {
    const { readImageDisplaySize } = await import("./image-display-size")

    await expect(readImageDisplaySize(jpeg())).resolves.toBeNull()
  })
})

/**
 * The module disables its `createImageBitmap` path under jsdom, because jsdom
 * cannot decode pixels. Reloading it behind a browser user-agent is the only
 * way to reach the code that actually runs on a phone — which is the code that
 * decides whether a portrait photo is stored portrait or sideways.
 */
describe("readImageDisplaySize — browser decode path", () => {
  const userAgent = Object.getOwnPropertyDescriptor(
    globalThis.navigator,
    "userAgent",
  )

  const loadAsBrowser = async () => {
    Object.defineProperty(globalThis.navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    })
    vi.resetModules()
    return await import("./image-display-size")
  }

  afterEach(() => {
    if (userAgent) {
      Object.defineProperty(globalThis.navigator, "userAgent", userAgent)
    }
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.useRealTimers()
  })

  it("reads the EXIF-corrected size from the decoded bitmap", async () => {
    const close = vi.fn()
    const createImageBitmap = vi.fn(async () => ({
      width: 3024,
      height: 4032,
      close,
    }))
    vi.stubGlobal("createImageBitmap", createImageBitmap)

    const { readImageDisplaySize } = await loadAsBrowser()
    const file = jpeg()

    await expect(readImageDisplaySize(file)).resolves.toEqual({
      width: 3024,
      height: 4032,
    })
    // `from-image` is what applies the EXIF rotation; without it an iPhone
    // portrait photo reports its landscape sensor dimensions.
    expect(createImageBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: "from-image",
    })
    // The bitmap holds decoded pixels; leaking it leaks memory per attachment.
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("falls back to the <img> element when the bitmap decode throws", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed")
      }),
    )
    const image = stubImageElement({ naturalWidth: 800, naturalHeight: 600 })

    const { readImageDisplaySize } = await loadAsBrowser()

    await expect(readImageDisplaySize(jpeg())).resolves.toEqual({
      width: 800,
      height: 600,
    })
    image.restore()
  })

  it("falls back when the bitmap reports no dimensions", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 0, height: 0, close: vi.fn() })),
    )
    const image = stubImageElement({ naturalWidth: 120, naturalHeight: 90 })

    const { readImageDisplaySize } = await loadAsBrowser()

    await expect(readImageDisplaySize(jpeg())).resolves.toEqual({
      width: 120,
      height: 90,
    })
    image.restore()
  })

  it("returns null when the <img> fallback also fails to load", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed")
      }),
    )
    const image = stubImageElement({ fail: true })

    const { readImageDisplaySize } = await loadAsBrowser()

    await expect(readImageDisplaySize(jpeg())).resolves.toBeNull()
    image.restore()
  })

  it("returns null when the <img> loads with no intrinsic size", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed")
      }),
    )
    const image = stubImageElement({ naturalWidth: 0, naturalHeight: 0 })

    const { readImageDisplaySize } = await loadAsBrowser()

    await expect(readImageDisplaySize(jpeg())).resolves.toBeNull()
    image.restore()
  })

  it("revokes the object URL on every path", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed")
      }),
    )
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:stub")
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {})
    const image = stubImageElement({ naturalWidth: 10, naturalHeight: 10 })

    const { readImageDisplaySize } = await loadAsBrowser()
    await readImageDisplaySize(jpeg())

    // Each attachment allocates one; a missed revoke pins the file in memory.
    expect(revokeSpy).toHaveBeenCalledWith("blob:stub")
    image.restore()
    createSpy.mockRestore()
    revokeSpy.mockRestore()
  })
})

/**
 * jsdom never fires `load` on an `<img>`, so the element is stubbed to resolve
 * synchronously with the dimensions under test.
 */
function stubImageElement(options: {
  naturalWidth?: number
  naturalHeight?: number
  fail?: boolean
}) {
  const createElement = document.createElement.bind(document)
  const spy = vi
    .spyOn(document, "createElement")
    .mockImplementation((tagName: string, ...rest: unknown[]) => {
      if (tagName !== "img") {
        return createElement(
          tagName as "div",
          ...(rest as [ElementCreationOptions?]),
        )
      }

      const element = {
        naturalWidth: options.naturalWidth ?? 0,
        naturalHeight: options.naturalHeight ?? 0,
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        set src(_value: string) {
          queueMicrotask(() => {
            if (options.fail) {
              element.onerror?.()
            } else {
              element.onload?.()
            }
          })
        },
      }
      return element as unknown as HTMLElement
    })

  return { restore: () => spy.mockRestore() }
}
