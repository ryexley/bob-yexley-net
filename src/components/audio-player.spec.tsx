import { fireEvent, render, screen } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AudioPlayer } from "@/components/audio-player"
import { iconGlyphs } from "@/components/icon-registry"

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubPlayerGlobals() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
}

function renderPlayer() {
  stubPlayerGlobals()
  return render(() => (
    <AudioPlayer
      src="https://example.com/ep.mp3"
      title="Episode"
    />
  ))
}

describe("AudioPlayer seek icons", () => {
  it("uses rotateCcw for rewind and the same glyph, flipped, for forward", () => {
    renderPlayer()

    const rewind = screen.getByRole("button", { name: "Rewind 10 seconds" })
    const forward = screen.getByRole("button", { name: "Forward 10 seconds" })

    expect(rewind.className).toContain("seek-action")
    expect(forward.className).toContain("seek-action")
    expect(forward.className).toContain("seek-forward")
    expect(rewind.className).not.toContain("seek-forward")

    const rotateCcwPath = iconGlyphs.rotateCcw.nodes.find(
      node => node.tag === "path",
    )
    expect(rotateCcwPath && "d" in rotateCcwPath).toBe(true)

    expect(rewind.querySelector("path")?.getAttribute("d")).toBe(
      rotateCcwPath && "d" in rotateCcwPath ? rotateCcwPath.d : undefined,
    )
    expect(forward.querySelector("path")?.getAttribute("d")).toBe(
      rotateCcwPath && "d" in rotateCcwPath ? rotateCcwPath.d : undefined,
    )
  })

  it("spins the Lucide SVG icons when seek buttons are pressed", () => {
    renderPlayer()

    const rewind = screen.getByRole("button", { name: "Rewind 10 seconds" })
    const forward = screen.getByRole("button", { name: "Forward 10 seconds" })

    fireEvent.mouseDown(rewind)
    expect(rewind.querySelector(".icon")?.classList.contains("spin-back")).toBe(
      true,
    )

    fireEvent.mouseDown(forward)
    expect(
      forward.querySelector(".icon")?.classList.contains("spin-forward"),
    ).toBe(true)
  })
})
