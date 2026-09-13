import { afterEach, describe, expect, it, vi } from "vitest"
import {
  composerMediaEmbedRuntime,
  getMediaEmbedRuntime,
  mediaEmbedPreviewFromAttachment,
  notifyMediaEmbedRuntime,
  setMediaEmbedRuntime,
  subscribeMediaEmbedRuntime,
  type MediaEmbedRuntime,
} from "./media-embed-runtime"

/**
 * The bridge between an inline `media-embed` node in the document and the
 * composer's upload state. Node views live inside ProseMirror and cannot reach
 * Solid signals, so they read through this registry instead.
 */

afterEach(() => {
  // Module-level singleton: leaving a runtime installed leaks into other specs.
  setMediaEmbedRuntime(null)
})

describe("mediaEmbedPreviewFromAttachment", () => {
  it("carries the preview fields a node view renders", () => {
    expect(
      mediaEmbedPreviewFromAttachment({
        key: "media/user-1/blip-1/photo",
        mediaType: "video",
        mimeType: "video/mp4",
        previewUrl: "blob:preview",
        posterUrl: "https://cdn.test/poster.webp",
        mediaSrc: "https://cdn.test/clip.mp4",
        status: "saved",
        progress: 100,
      }),
    ).toEqual({
      key: "media/user-1/blip-1/photo",
      mediaType: "video",
      mimeType: "video/mp4",
      previewUrl: "blob:preview",
      posterUrl: "https://cdn.test/poster.webp",
      mediaSrc: "https://cdn.test/clip.mp4",
      status: "saved",
      progress: 100,
    })
  })

  it("defaults an untyped attachment to an image", () => {
    const preview = mediaEmbedPreviewFromAttachment({ key: "k" })

    expect(preview.mediaType).toBe("image")
    expect(preview.previewUrl).toBeUndefined()
  })
})

describe("composerMediaEmbedRuntime", () => {
  const attachment = (key: string) => ({
    key,
    mediaType: "image" as const,
    previewUrl: `blob:${key}`,
    status: "saved" as const,
  })

  it("resolves a preview by storage key", () => {
    const runtime = composerMediaEmbedRuntime({
      attachments: () => [attachment("a"), attachment("b")],
      removeAttachment: vi.fn(),
    })

    expect(runtime.getPreview("b")).toMatchObject({
      key: "b",
      previewUrl: "blob:b",
    })
  })

  it("returns null for a key the composer does not know", () => {
    const runtime = composerMediaEmbedRuntime({
      attachments: () => [attachment("a")],
      removeAttachment: vi.fn(),
    })

    expect(runtime.getPreview("missing")).toBeNull()
  })

  it("reads attachments live rather than capturing them once", () => {
    let attachments = [attachment("a")]
    const runtime = composerMediaEmbedRuntime({
      attachments: () => attachments,
      removeAttachment: vi.fn(),
    })

    expect(runtime.getPreview("b")).toBeNull()
    attachments = [attachment("a"), attachment("b")]
    expect(runtime.getPreview("b")).not.toBeNull()
  })

  it("detaches the media when its inline node is deleted", () => {
    const removeAttachment = vi.fn()
    const runtime = composerMediaEmbedRuntime({
      attachments: () => [attachment("a")],
      removeAttachment,
    })

    // Deleting the node in the document is the only way to remove inline media
    // — it has no thumbnail in the rail to remove it from.
    runtime.onNodeRemoved?.("a")

    expect(removeAttachment).toHaveBeenCalledWith("a")
  })

  it("forwards the composer's paste handler when one is supplied", () => {
    const consumeClipboardPaste = vi.fn(() => true)
    const runtime = composerMediaEmbedRuntime(
      { attachments: () => [], removeAttachment: vi.fn() },
      { consumeClipboardPaste },
    )

    const event = {} as ClipboardEvent
    expect(runtime.consumeClipboardPaste?.(event)).toBe(true)
    expect(consumeClipboardPaste).toHaveBeenCalledWith(event)
  })

  it("leaves the paste handler unset when the composer supplies none", () => {
    const runtime = composerMediaEmbedRuntime({
      attachments: () => [],
      removeAttachment: vi.fn(),
    })

    expect(runtime.consumeClipboardPaste).toBeUndefined()
  })
})

describe("the media embed runtime registry", () => {
  const stubRuntime = (
    overrides: Partial<MediaEmbedRuntime> = {},
  ): MediaEmbedRuntime => ({
    getPreview: () => null,
    subscribe: () => () => {},
    ...overrides,
  })

  it("starts empty so node views can render a placeholder", () => {
    expect(getMediaEmbedRuntime()).toBeNull()
  })

  it("installs and clears the active runtime", () => {
    const runtime = stubRuntime()

    setMediaEmbedRuntime(runtime)
    expect(getMediaEmbedRuntime()).toBe(runtime)

    setMediaEmbedRuntime(null)
    expect(getMediaEmbedRuntime()).toBeNull()
  })

  it("notifies subscribers when the runtime is swapped", () => {
    const listener = vi.fn()
    subscribeMediaEmbedRuntime(listener)

    // Opening a different blip replaces the store, and every mounted node view
    // has to re-read its preview from the new one.
    setMediaEmbedRuntime(stubRuntime())

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("notifies subscribers on an explicit upload-progress nudge", () => {
    const listener = vi.fn()
    setMediaEmbedRuntime(stubRuntime())
    listener.mockClear()
    subscribeMediaEmbedRuntime(listener)

    notifyMediaEmbedRuntime()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("also subscribes through to the installed runtime", () => {
    const nested = vi.fn()
    const subscribe = vi.fn(() => nested)
    setMediaEmbedRuntime(stubRuntime({ subscribe }))

    const unsubscribe = subscribeMediaEmbedRuntime(vi.fn())
    expect(subscribe).toHaveBeenCalledTimes(1)

    unsubscribe()
    expect(nested).toHaveBeenCalledTimes(1)
  })

  it("stops notifying a listener once it unsubscribes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeMediaEmbedRuntime(listener)

    unsubscribe()
    notifyMediaEmbedRuntime()

    expect(listener).not.toHaveBeenCalled()
  })

  it("subscribes without a runtime installed", () => {
    const listener = vi.fn()

    const unsubscribe = subscribeMediaEmbedRuntime(listener)
    notifyMediaEmbedRuntime()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(() => unsubscribe()).not.toThrow()
  })
})
