import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ScriptureReference,
  requestPassage,
} from "@/modules/blips/components/scripture-reference"

const { latestDrawerProps, viewportWidth } = vi.hoisted(() => ({
  latestDrawerProps: {
    value: null as any,
  },
  viewportWidth: vi.fn(() => 1024),
}))

vi.mock("@/components/drawer", () => ({
  DrawerPosition: {
    BOTTOM: "bottom",
  },
  Drawer: (props: any) => {
    latestDrawerProps.value = props
    return (
      <div
        data-testid="scripture-reference-drawer"
        data-open={props.open ? "true" : "false"}>
        <div data-testid="scripture-reference-drawer-title">{props.title}</div>
        {props.children}
      </div>
    )
  },
}))

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
    viewportWidth.mockReturnValue(1024)
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: viewportWidth(),
    })
    latestDrawerProps.value = null
    vi.restoreAllMocks()
  })

  it("starts a passage fetch on first hover intent on desktop", async () => {
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

  it("does not refetch after the first hover intent on desktop", async () => {
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

  it("opens a bottom drawer and fetches on tap at mobile widths", async () => {
    viewportWidth.mockReturnValue(640)
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 640,
    })
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

    await fireEvent.click(screen.getByText("John 11:35"))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(
        screen.getByTestId("scripture-reference-drawer").getAttribute("data-open"),
      ).toBe("true")
    })

    expect(latestDrawerProps.value).toMatchObject({
      side: "bottom",
      drawerProps: expect.objectContaining({
        snapPoints: [0, 0.5, 1],
        defaultSnapPoint: 0.5,
        closeOnOutsidePointer: true,
      }),
    })
  })
})
