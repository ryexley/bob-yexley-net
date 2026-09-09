import { render, screen, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import {
  GlobalLoadingIndicator,
  TopLoadingBar,
} from "@/components/global-loading-indicator"

const routingState = vi.hoisted(() => ({
  active: false,
}))

vi.mock("@solidjs/router", () => ({
  useIsRouting: () => () => routingState.active,
}))

describe("TopLoadingBar", () => {
  it("shows progress while routing and hides when the transition ends", async () => {
    const [active, setActive] = createSignal(false)

    render(() => (
      <TopLoadingBar
        active={active()}
        waitingTime={10}
        minVisibleTime={0}
      />
    ))

    expect(screen.getByRole("progressbar", { hidden: true }).getAttribute("aria-hidden")).toBe(
      "true",
    )

    setActive(true)

    await waitFor(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
      expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThan(0)
    })

    setActive(false)

    await waitFor(
      () => {
        expect(screen.getByRole("progressbar", { hidden: true }).getAttribute("aria-hidden")).toBe(
          "true",
        )
      },
      { timeout: 1500 },
    )
  })

  it("stays visible until the minimum progress time has elapsed", async () => {
    const [active, setActive] = createSignal(false)

    render(() => (
      <TopLoadingBar
        active={active()}
        waitingTime={10}
        minVisibleTime={80}
      />
    ))

    setActive(true)
    await waitFor(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
    })

    setActive(false)
    expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
  })

  it("does not rewind if routing stays active", async () => {
    const [active] = createSignal(true)

    render(() => (
      <TopLoadingBar
        active={active()}
        incrementInterval={20}
        waitingTime={20}
      />
    ))

    await waitFor(() => {
      expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThan(0)
    })

    const before = Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(
      before,
    )
  })
})

describe("GlobalLoadingIndicator", () => {
  it("follows useIsRouting", async () => {
    routingState.active = true

    render(() => <GlobalLoadingIndicator />)

    await waitFor(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
    })
  })
})
