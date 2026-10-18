import { afterEach, describe, expect, it, vi } from "vitest"
import { loadTwitterWidgets } from "./x-widgets"

afterEach(() => {
  document.getElementById("twitter-wjs")?.remove()
  delete (globalThis as { twttr?: unknown }).twttr
})

describe("loadTwitterWidgets", () => {
  it("resolves an already-loaded widgets API", async () => {
    const twttr = {
      widgets: { createTweet: vi.fn() },
      ready: vi.fn(),
    }
    ;(globalThis as { twttr?: unknown }).twttr = twttr

    await expect(loadTwitterWidgets()).resolves.toBe(twttr)
    expect(document.getElementById("twitter-wjs")).toBeNull()
  })

  it("injects widgets.js and resolves through ready()", async () => {
    const pending = loadTwitterWidgets()
    expect(document.getElementById("twitter-wjs")?.getAttribute("src")).toBe(
      "https://platform.twitter.com/widgets.js",
    )

    const live = {
      widgets: { createTweet: vi.fn() },
      ready: vi.fn(),
    }
    const stub = (
      globalThis as {
        twttr?: { _e?: Array<(value: typeof live) => void> }
      }
    ).twttr
    for (const callback of stub?._e ?? []) {
      callback(live)
    }

    await expect(pending).resolves.toBe(live)
  })
})
