import { fireEvent, render, screen } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InlineBlipMedia } from "./inline-blip-media"

beforeEach(() => {
  vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("InlineBlipMedia gif playback", () => {
  it("toggles play and pause from the hover overlay", () => {
    render(() => (
      <InlineBlipMedia
        embed={{
          key: "media/u/b/loop",
          type: "gif",
          mime: "image/gif",
        }}
      />
    ))

    const toggle = screen.getByRole("button", { name: "Pause animation" })
    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    expect(
      document.querySelector(".frame")?.classList.contains("is-paused"),
    ).toBe(false)

    fireEvent.click(toggle)

    expect(screen.getByRole("button", { name: "Play animation" })).toBeTruthy()
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    expect(
      document.querySelector(".frame")?.classList.contains("is-paused"),
    ).toBe(true)

    fireEvent.click(toggle)

    expect(screen.getByRole("button", { name: "Pause animation" })).toBeTruthy()
    expect(
      document.querySelector(".frame")?.classList.contains("is-paused"),
    ).toBe(false)
  })
})

describe("InlineBlipMedia layout", () => {
  it("applies size and alignment to the embed container", () => {
    render(() => (
      <InlineBlipMedia
        embed={{
          key: "media/u/b/loop",
          type: "gif",
          mime: "image/gif",
          size: "50",
          align: "center",
        }}
      />
    ))

    const embed = document.querySelector(".media-embed")
    expect(embed?.getAttribute("data-media-size")).toBe("50")
    expect(embed?.getAttribute("data-media-align")).toBe("center")
  })

  it("defaults missing layout to full width, left aligned", () => {
    render(() => (
      <InlineBlipMedia
        embed={{
          key: "media/u/b/shot",
          type: "image",
        }}
      />
    ))

    const embed = document.querySelector(".media-embed")
    expect(embed?.getAttribute("data-media-size")).toBe("100")
    expect(embed?.getAttribute("data-media-align")).toBe("left")
  })
})

describe("InlineBlipMedia lightbox", () => {
  const record = {
    id: "row",
    blip_id: "blip-1",
    user_id: "user-1",
    media_type: "image",
    mime_type: "image/jpeg",
    storage_key: "media/u/b/shot",
    processing_status: "complete",
    file_size: 1000,
    width: 1600,
    height: 1200,
    duration_s: null,
    display_order: 0,
    created_at: "2026-06-20T00:00:00.000Z",
  }

  it("does not open a lightbox when the toggle is off", () => {
    const onOpen = vi.fn()
    render(() => (
      <InlineBlipMedia
        embed={{
          key: "media/u/b/shot",
          type: "image",
        }}
        record={record as never}
        onOpen={onOpen}
      />
    ))

    expect(screen.queryByRole("button", { name: "View full image" })).toBeNull()
    fireEvent.click(document.querySelector(".media") as Element)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it("opens the lightbox when the toggle is on", () => {
    const onOpen = vi.fn()
    render(() => (
      <InlineBlipMedia
        embed={{
          key: "media/u/b/shot",
          type: "image",
          lightbox: true,
        }}
        record={record as never}
        onOpen={onOpen}
      />
    ))

    fireEvent.click(screen.getByRole("button", { name: "View full image" }))
    expect(onOpen).toHaveBeenCalledWith(record)
  })

  it("opens the lightbox from embed props when no media row is loaded", () => {
    const onOpen = vi.fn()
    render(() => (
      <InlineBlipMedia
        embed={{
          key: "media/u/b/shot",
          type: "image",
          mime: "image/jpeg",
          lightbox: true,
        }}
        onOpen={onOpen}
      />
    ))

    fireEvent.click(screen.getByRole("button", { name: "View full image" }))
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_key: "media/u/b/shot",
        media_type: "image",
      }),
    )
  })
})
