import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { extractThumbnail } from "./thumbnail-extract"

const videoFile = () =>
  new File([new Uint8Array([0, 1, 2])], "clip.mp4", { type: "video/mp4" })
const gifFile = () =>
  new File([new Uint8Array([0, 1, 2])], "loop.gif", { type: "image/gif" })
const imageFile = () =>
  new File([new Uint8Array([0, 1, 2])], "photo.jpg", { type: "image/jpeg" })

describe("extractThumbnail", () => {
  it("never extracts for images", async () => {
    // Image variants are generated server-side by `/api/media/process`.
    await expect(extractThumbnail(imageFile(), "image")).resolves.toBeNull()
  })

  it("returns null when object URLs are unavailable", async () => {
    const original = URL.createObjectURL
    ;(URL as unknown as { createObjectURL?: unknown }).createObjectURL =
      undefined

    await expect(extractThumbnail(videoFile(), "video")).resolves.toBeNull()

    URL.createObjectURL = original
  })
})

/**
 * jsdom has no codecs and no 2D canvas context, so the decode pipeline is
 * driven through fakes. This is the only path that can produce a poster frame
 * for a video or a static frame for a GIF — `sharp` cannot decode either, so a
 * failure here means those attachments upload with no thumbnail at all.
 */
describe("extractThumbnail — decode pipeline", () => {
  type CanvasStub = {
    toBlobAvailable: boolean
    contextAvailable: boolean
    drawn: boolean
    encoded: Blob | null
  }

  let canvasStub: CanvasStub
  let createdCanvases: number
  let revoked: string[]
  let createElement: typeof document.createElement

  const makeCanvas = () => {
    createdCanvases += 1
    const canvas = {
      width: 0,
      height: 0,
      getContext: () =>
        canvasStub.contextAvailable
          ? {
              drawImage: () => {
                canvasStub.drawn = true
              },
            }
          : null,
      ...(canvasStub.toBlobAvailable
        ? {
            toBlob: (
              callback: (blob: Blob | null) => void,
              mime?: string,
              quality?: number,
            ) => {
              canvasStub.encoded = canvasStub.drawn
                ? new Blob([new Uint8Array([9, 9])], {
                    type: mime ?? "image/webp",
                  })
                : null
              expect(mime).toBe("image/webp")
              expect(quality).toBe(0.8)
              queueMicrotask(() => callback(canvasStub.encoded))
            },
          }
        : {}),
    }
    return canvas as unknown as HTMLCanvasElement
  }

  /** Fires `loadeddata` on `src`, then `seeked` whenever `currentTime` is set. */
  const makeVideo = (options: {
    videoWidth?: number
    videoHeight?: number
    duration?: number
    failOnLoad?: boolean
    seekThrows?: boolean
    neverLoads?: boolean
  }) => {
    const listeners: Record<string, (() => void)[]> = {}
    const video = {
      videoWidth: options.videoWidth ?? 1920,
      videoHeight: options.videoHeight ?? 1080,
      duration: options.duration ?? 12.4,
      muted: false,
      playsInline: false,
      preload: "",
      seekedTo: undefined as number | undefined,
      addEventListener: (type: string, callback: () => void) => {
        ;(listeners[type] ||= []).push(callback)
      },
      removeAttribute: () => {},
      load: () => {},
      set currentTime(value: number) {
        if (options.seekThrows) {
          throw new Error("seeking unsupported")
        }
        video.seekedTo = value
        queueMicrotask(() => listeners.seeked?.forEach(callback => callback()))
      },
      set src(_value: string) {
        if (options.neverLoads) {
          return
        }
        queueMicrotask(() => {
          if (options.failOnLoad) {
            listeners.error?.forEach(callback => callback())
          } else {
            listeners.loadeddata?.forEach(callback => callback())
          }
        })
      },
    }
    return video
  }

  const makeImage = (options: {
    naturalWidth?: number
    naturalHeight?: number
    failOnLoad?: boolean
  }) => {
    const listeners: Record<string, (() => void)[]> = {}
    return {
      naturalWidth: options.naturalWidth ?? 400,
      naturalHeight: options.naturalHeight ?? 300,
      addEventListener: (type: string, callback: () => void) => {
        ;(listeners[type] ||= []).push(callback)
      },
      set src(_value: string) {
        queueMicrotask(() => {
          if (options.failOnLoad) {
            listeners.error?.forEach(callback => callback())
          } else {
            listeners.load?.forEach(callback => callback())
          }
        })
      },
    }
  }

  const useVideo = (video: unknown) => {
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string, ...rest: unknown[]) => {
        if (tagName === "video") {
          return video as HTMLElement
        }
        if (tagName === "canvas") {
          return makeCanvas()
        }
        return createElement.call(
          document,
          tagName as "div",
          ...(rest as [ElementCreationOptions?]),
        )
      },
    )
  }

  const useImage = (image: unknown) => {
    vi.stubGlobal(
      "Image",
      class {
        constructor() {
          return image
        }
      },
    )
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string, ...rest: unknown[]) => {
        if (tagName === "canvas") {
          return makeCanvas()
        }
        return createElement.call(
          document,
          tagName as "div",
          ...(rest as [ElementCreationOptions?]),
        )
      },
    )
  }

  beforeEach(() => {
    createElement = document.createElement
    canvasStub = {
      toBlobAvailable: true,
      contextAvailable: true,
      drawn: false,
      encoded: null,
    }
    createdCanvases = 0
    revoked = []
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:media")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(url => {
      revoked.push(url)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe("video", () => {
    it("seeks past the first frame, encodes WebP, and reports duration", async () => {
      const video = makeVideo({ duration: 12.4 })
      useVideo(video)

      const result = await extractThumbnail(videoFile(), "video")

      expect(result).not.toBeNull()
      expect(result?.blob.type).toBe("image/webp")
      expect(result?.width).toBe(1920)
      expect(result?.height).toBe(1080)
      // Rounded to whole seconds for the `duration_s` column.
      expect(result?.durationS).toBe(12)
      // Some decoders hold a black frame at exactly t=0.
      expect(video.seekedTo).toBe(0.1)
      expect(createdCanvases).toBe(1)
      expect(revoked).toEqual(["blob:media"])
    })

    it("does not seek past the end of a very short clip", async () => {
      const video = makeVideo({ duration: 0.05 })
      useVideo(video)

      await extractThumbnail(videoFile(), "video")

      expect(video.seekedTo).toBe(0)
    })

    it("omits duration when the container reports none", async () => {
      useVideo(makeVideo({ duration: Number.NaN }))

      const result = await extractThumbnail(videoFile(), "video")

      expect(result?.durationS).toBeUndefined()
      expect(result?.blob).toBeInstanceOf(Blob)
    })

    it("grabs whatever frame is decoded when seeking is unsupported", async () => {
      useVideo(makeVideo({ seekThrows: true }))

      const result = await extractThumbnail(videoFile(), "video")

      expect(result?.width).toBe(1920)
    })

    it("resolves null on a decode error", async () => {
      useVideo(makeVideo({ failOnLoad: true }))

      await expect(extractThumbnail(videoFile(), "video")).resolves.toBeNull()
      expect(revoked).toEqual(["blob:media"])
    })

    it("resolves null for a stream with no intrinsic size", async () => {
      useVideo(makeVideo({ videoWidth: 0, videoHeight: 0 }))

      await expect(extractThumbnail(videoFile(), "video")).resolves.toBeNull()
      // No canvas is allocated for a zero-sized frame.
      expect(createdCanvases).toBe(0)
    })

    it("resolves null when the canvas has no 2D context", async () => {
      canvasStub.contextAvailable = false
      useVideo(makeVideo({}))

      await expect(extractThumbnail(videoFile(), "video")).resolves.toBeNull()
    })

    it("resolves null when the browser cannot encode to a blob", async () => {
      canvasStub.toBlobAvailable = false
      useVideo(makeVideo({}))

      await expect(extractThumbnail(videoFile(), "video")).resolves.toBeNull()
    })

    it("gives up rather than hanging the upload on a wedged decode", async () => {
      vi.useFakeTimers()
      useVideo(makeVideo({ neverLoads: true }))

      const pending = extractThumbnail(videoFile(), "video")
      await vi.advanceTimersByTimeAsync(10_000)

      // A corrupt or unsupported codec must not block the queue forever.
      await expect(pending).resolves.toBeNull()
      expect(revoked).toEqual(["blob:media"])
    })
  })

  describe("gif", () => {
    it("captures the first frame with no duration", async () => {
      useImage(makeImage({ naturalWidth: 400, naturalHeight: 300 }))

      const result = await extractThumbnail(gifFile(), "gif")

      expect(result?.blob.type).toBe("image/webp")
      expect(result?.width).toBe(400)
      expect(result?.height).toBe(300)
      expect(result?.durationS).toBeUndefined()
      expect(revoked).toEqual(["blob:media"])
    })

    it("resolves null when the GIF cannot be decoded", async () => {
      useImage(makeImage({ failOnLoad: true }))

      await expect(extractThumbnail(gifFile(), "gif")).resolves.toBeNull()
      expect(revoked).toEqual(["blob:media"])
    })

    it("resolves null for a GIF with no intrinsic size", async () => {
      useImage(makeImage({ naturalWidth: 0, naturalHeight: 0 }))

      await expect(extractThumbnail(gifFile(), "gif")).resolves.toBeNull()
    })

    it("gives up on a GIF that never loads", async () => {
      vi.useFakeTimers()
      const listeners: Record<string, (() => void)[]> = {}
      useImage({
        naturalWidth: 1,
        naturalHeight: 1,
        addEventListener: (type: string, callback: () => void) => {
          ;(listeners[type] ||= []).push(callback)
        },
        set src(_value: string) {},
      })

      const pending = extractThumbnail(gifFile(), "gif")
      await vi.advanceTimersByTimeAsync(10_000)

      await expect(pending).resolves.toBeNull()
    })
  })

  it("swallows an unexpected throw so the upload continues", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("createElement exploded")
    })

    await expect(extractThumbnail(videoFile(), "video")).resolves.toBeNull()
    expect(error).toHaveBeenCalled()
  })
})
