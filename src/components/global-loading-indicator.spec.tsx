import { render, screen, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import {
  GlobalLoadingIndicator,
  TopLoadingBar,
  useGlobalPageLoading,
} from "@/components/global-loading-indicator"

function PageLoadProbe(props: { loading: () => boolean }) {
  useGlobalPageLoading(props.loading)
  return <GlobalLoadingIndicator />
}

vi.mock("@solidjs/router", () => ({
  useIsRouting: () => () => false,
}))

const authState = vi.hoisted(() => ({
  loading: false,
  busy: false,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    loading: () => authState.loading,
    busy: () => authState.busy,
  }),
}))

describe("TopLoadingBar", () => {
  it("shows progress while active and completes without staying visible", async () => {
    const [active, setActive] = createSignal(false)

    render(() => (
      <TopLoadingBar
        active={active()}
        waitingTime={10}
        minVisibleTime={0}
      />
    ))

    const bar = screen.getByRole("progressbar", { hidden: true })
    expect(bar.getAttribute("aria-hidden")).toBe("true")

    setActive(true)

    await waitFor(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
      expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThan(0)
    })

    setActive(false)

    await waitFor(() => {
      expect(screen.getByRole("progressbar", { hidden: true }).getAttribute("aria-hidden")).toBe(
        "true",
      )
    })
  })

  it("keeps crawling instead of jumping to 100 when work ends immediately", async () => {
    const [active, setActive] = createSignal(false)

    render(() => (
      <TopLoadingBar
        active={active()}
        waitingTime={20}
        minVisibleTime={80}
        incrementInterval={20}
      />
    ))

    setActive(true)

    await waitFor(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
    })

    setActive(false)

    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeLessThan(100)
  })
})

describe("GlobalLoadingIndicator", () => {
  it("starts when auth is busy even if page loading is false", async () => {
    authState.loading = false
    authState.busy = true

    render(() => <GlobalLoadingIndicator />)

    await waitFor(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
    })
  })

  it("stays active while a page reports loading", async () => {
    authState.loading = false
    authState.busy = false
    const [pageLoading, setPageLoading] = createSignal(true)

    render(() => <PageLoadProbe loading={pageLoading} />)

    await waitFor(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-hidden")).toBeNull()
    })

    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeLessThan(100)
    setPageLoading(false)
  })
})
