import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { ErrorBoundary, Suspense } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RouteError, RouteFallback } from "@/components/route-boundary"

const routerState = vi.hoisted(() => ({
  revalidate: vi.fn(async () => {}),
}))

// Only `revalidate` is swapped; the rest of the router stays real.
vi.mock("@solidjs/router", async importOriginal => {
  const actual = await importOriginal<typeof import("@solidjs/router")>()

  return { ...actual, revalidate: routerState.revalidate }
})

describe("RouteFallback", () => {
  it("announces itself politely rather than rendering nothing", () => {
    // The whole point of replacing `fallback={null}`: a suspended route has to
    // look alive, and to a screen reader that means a live region.
    const { container } = render(() => <RouteFallback />)
    const status = container.querySelector(".route-boundary")

    expect(status?.getAttribute("role")).toBe("status")
    expect(status?.getAttribute("aria-live")).toBe("polite")
    expect(screen.getByText("Loading ...")).toBeTruthy()
  })
})

describe("RouteError", () => {
  beforeEach(() => {
    routerState.revalidate.mockClear()
    routerState.revalidate.mockImplementation(async () => {})
  })

  it("surfaces the underlying failure alongside a way out", () => {
    render(() => (
      <RouteError
        error={new Error("relation \"blip_media\" does not exist")}
        onReset={() => {}}
      />
    ))

    expect(screen.getByText("Something went wrong")).toBeTruthy()
    expect(
      screen.getByText("relation \"blip_media\" does not exist"),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy()
  })

  it("drops cached query failures before re-rendering the route", async () => {
    const order: string[] = []
    routerState.revalidate.mockImplementation(async () => {
      order.push("revalidate")
    })
    const onReset = vi.fn(() => {
      order.push("reset")
    })

    render(() => (
      <RouteError
        error={new Error("boom")}
        onReset={onReset}
      />
    ))

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1)
    })

    // The order is the entire fix. Resetting first re-renders into the same
    // failed cache entry, which throws again and lands straight back here —
    // a retry button that cannot retry.
    expect(order).toEqual(["revalidate", "reset"])
  })

  it("re-renders anyway when dropping the cache fails", async () => {
    // Offline, most likely. Leaving the reader parked on the error screen with
    // a dead button is worse than trying the render and failing again.
    vi.spyOn(console, "error").mockImplementation(() => {})
    routerState.revalidate.mockImplementation(async () => {
      throw new Error("offline")
    })
    const onReset = vi.fn()

    render(() => (
      <RouteError
        error={new Error("boom")}
        onReset={onReset}
      />
    ))

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1)
    })
  })

  it("renders a thrown non-Error without falling over itself", () => {
    render(() => (
      <RouteError
        error="a string was thrown"
        onReset={() => {}}
      />
    ))

    expect(screen.getByText("a string was thrown")).toBeTruthy()
  })
})

describe("the boundary arrangement app.tsx installs", () => {
  beforeEach(() => {
    routerState.revalidate.mockClear()
    routerState.revalidate.mockImplementation(async () => {})
  })

  /**
   * The reason both boundaries exist at all. Before this, a route that threw
   * during render had nothing to catch it and the only way back was a manual
   * page refresh — which is exactly what the author kept having to do.
   */
  it("puts a route that throws once back on screen after a retry", async () => {
    let attempts = 0

    const Route = () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error("first attempt fails")
      }

      return <p data-testid="route">route content</p>
    }

    render(() => (
      <ErrorBoundary
        fallback={(error, reset) => (
          <RouteError
            error={error}
            onReset={reset}
          />
        )}>
        <Suspense fallback={<RouteFallback />}>
          <Route />
        </Suspense>
      </ErrorBoundary>
    ))

    expect(screen.getByText("first attempt fails")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => {
      expect(screen.getByTestId("route").textContent).toBe("route content")
    })
  })
})
