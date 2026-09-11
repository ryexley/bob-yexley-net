import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  harvestMediaFromElement,
  harvestMediaFromHtml,
  htmlIsMediaOnly,
  readClipboardHtml,
} from "./clipboard-media-harvest"

const originalFetch = globalThis.fetch

// jsdom cannot fetch blob: URLs, so stand in for WebKit's blob store.
const blobStore = new Map<string, Blob>()

const stubBlob = (url: string, type: string, body = "bytes") => {
  blobStore.set(url, new Blob([body], { type }))
  return url
}

beforeEach(() => {
  blobStore.clear()
  globalThis.fetch = vi.fn(async (input: any) => {
    const url = String(input)
    const blob = blobStore.get(url)
    if (!blob) {
      throw new Error(`no blob for ${url}`)
    }
    return { blob: async () => blob } as unknown as Response
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("harvestMediaFromHtml", () => {
  it("recovers a photo iOS only exposed as a blob URL", async () => {
    const url = stubBlob("blob:https://site/abc", "image/jpeg")

    const files = await harvestMediaFromHtml(`<img src="${url}">`)

    expect(files).toHaveLength(1)
    expect(files[0].type).toBe("image/jpeg")
    expect(files[0].name).toBe("image.jpg")
  })

  it("recovers video sources as well as images", async () => {
    const url = stubBlob("blob:https://site/clip", "video/quicktime")

    const files = await harvestMediaFromHtml(`<video src="${url}"></video>`)

    expect(files.map(file => file.name)).toEqual(["video.mov"])
  })

  it("skips remote sources so pasting an article downloads nothing", async () => {
    const files = await harvestMediaFromHtml(
      `<img src="https://example.com/cat.png">`,
    )

    expect(files).toEqual([])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("drops non-media blobs", async () => {
    const url = stubBlob("blob:https://site/page", "text/html")

    expect(await harvestMediaFromHtml(`<img src="${url}">`)).toEqual([])
  })

  it("deduplicates a source referenced twice", async () => {
    const url = stubBlob("blob:https://site/once", "image/png")

    const files = await harvestMediaFromHtml(
      `<img src="${url}"><img src="${url}">`,
    )

    expect(files).toHaveLength(1)
  })

  it("survives a revoked blob URL", async () => {
    const files = await harvestMediaFromHtml(
      `<img src="blob:https://site/gone">`,
    )

    expect(files).toEqual([])
  })
})

describe("harvestMediaFromElement", () => {
  it("reads markup WebKit inserted into the paste target", async () => {
    const url = stubBlob("blob:https://site/pasted", "image/gif")
    const region = document.createElement("div")
    region.innerHTML = `<img src="${url}">`

    const files = await harvestMediaFromElement(region)

    expect(files.map(file => file.name)).toEqual(["image.gif"])
  })

  it("returns nothing for an empty target", async () => {
    expect(
      await harvestMediaFromElement(document.createElement("div")),
    ).toEqual([])
  })
})

describe("htmlIsMediaOnly", () => {
  it("treats a bare pasted image as media", () => {
    expect(htmlIsMediaOnly(`<img src="blob:https://site/a">`)).toBe(true)
  })

  it("treats prose containing images as text", () => {
    expect(
      htmlIsMediaOnly(`<p>Look at this</p><img src="blob:https://site/a">`),
    ).toBe(false)
  })

  it("is false without media", () => {
    expect(htmlIsMediaOnly("<p>hello</p>")).toBe(false)
    expect(htmlIsMediaOnly("")).toBe(false)
  })
})

describe("readClipboardHtml", () => {
  it("returns the html flavor", () => {
    const data = { getData: () => "<img>" } as unknown as DataTransfer
    expect(readClipboardHtml(data)).toBe("<img>")
  })

  it("tolerates a clipboard that refuses the read", () => {
    const data = {
      getData: () => {
        throw new Error("nope")
      },
    } as unknown as DataTransfer

    expect(readClipboardHtml(data)).toBe("")
    expect(readClipboardHtml(null)).toBe("")
  })
})
