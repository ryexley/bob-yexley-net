import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ScriptureReference,
  requestPassage,
} from "@/modules/blips/components/scripture-reference"

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("requestPassage", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns loaded passage text from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          passage: "And we know that for those who love God...",
        }),
      }),
    )

    await expect(
      requestPassage({
        book: "Romans",
        chapter: 8,
        startVerse: 28,
        endVerse: null,
      }),
    ).resolves.toEqual({
      status: "loaded",
      text: "And we know that for those who love God...",
    })
  })

  it("returns error state when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    )

    await expect(
      requestPassage({
        book: "Romans",
        chapter: 8,
        startVerse: 28,
        endVerse: null,
      }),
    ).resolves.toEqual({
      status: "error",
    })
  })
})

describe("ScriptureReference", () => {
  beforeEach(() => {
    mockMatchMedia(false)
    vi.restoreAllMocks()
  })

  it("starts a passage fetch on first hover intent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          passage: "Jesus wept.",
        }),
      }),
    )

    render(() => (
      <ScriptureReference
        book="John"
        chapter={11}
        startVerse={35}
        normalized="John 11:35">
        John 11:35
      </ScriptureReference>
    ))

    await fireEvent.pointerEnter(screen.getByText("John 11:35"))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    expect(String((fetch as any).mock.calls[0][0])).toContain(
      "/api/bible/passage?book=John&chapter=11&start_verse=35",
    )
  })

  it("does not refetch after the first hover intent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          passage: "Jesus wept.",
        }),
      }),
    )

    render(() => (
      <ScriptureReference
        book="John"
        chapter={11}
        startVerse={35}
        normalized="John 11:35">
        John 11:35
      </ScriptureReference>
    ))

    const trigger = screen.getByText("John 11:35")
    await fireEvent.pointerEnter(trigger)
    await fireEvent.pointerEnter(trigger)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})
