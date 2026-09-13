import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen, waitFor } from "@solidjs/testing-library"
import { createAsync } from "@solidjs/router"
import { createMemo, createSignal, Suspense } from "solid-js"
import { describe, expect, it } from "vitest"

/**
 * `BlipView` reads `blipGraphQuery` and `blipMediaQuery` as `query.latest`
 * rather than calling the accessor. That is load-bearing and not at all obvious
 * from the call site, so these tests pin the two behaviours the choice depends
 * on rather than trusting them to survive a dependency bump.
 *
 * It matters because the root `<Suspense fallback={null}>` in `app.tsx` is the
 * only Suspense boundary in the app. Anything that suspends takes the entire
 * screen with it — header, dock and all — which is exactly what publishing an
 * update used to do: the new update lands in the store, `mediaBlipIds` grows,
 * the media query refetches, and the page went blank until it came back.
 */
describe("createAsync read modes the blip detail page depends on", () => {
  type Harness = {
    resolveFetch: (generation: number, value: string) => void
    triggerRefetch: () => void
  }

  const renderReader = (mode: "accessor" | "latest"): Harness => {
    const [generation, setGeneration] = createSignal(0)
    const resolvers = new Map<number, (value: string) => void>()

    const fetchFor = (value: number) =>
      new Promise<string>(resolve => {
        resolvers.set(value, resolve)
      })

    // The nesting matters and is easy to get wrong: a resource only registers
    // with a boundary it can reach through `useContext`, so the query has to be
    // created *under* the Suspense, not alongside it. That mirrors the real
    // tree, where the boundary is in `app.tsx` and `BlipView` renders beneath
    // it — which is why a suspending read there empties the whole page.
    const Reader = () => {
      const query = createAsync(() => fetchFor(generation()))
      // The real view funnels both queries through memos exactly like this.
      const value = createMemo(() =>
        mode === "latest" ? query.latest : query(),
      )

      return <span data-testid="value">{value() ?? ""}</span>
    }

    render(() => (
      <Suspense fallback={<span data-testid="fallback">suspended</span>}>
        <Reader />
      </Suspense>
    ))

    return {
      resolveFetch: (gen, value) => resolvers.get(gen)?.(value),
      triggerRefetch: () => setGeneration(current => current + 1),
    }
  }

  /**
   * Async SSR for `/blips/:id` depends on this: `entry-server.tsx` forces
   * `mode: "async"` on that route so link unfurlers get resolved `og:` tags in
   * the first response, which only works if an unresolved read still suspends.
   */
  it("suspends on the first read, before the query has ever resolved", async () => {
    const harness = renderReader("latest")

    expect(screen.queryByTestId("fallback")).toBeTruthy()

    harness.resolveFetch(0, "first")

    await waitFor(() => {
      expect(screen.getByTestId("value").textContent).toBe("first")
    })

    expect(screen.queryByTestId("fallback")).toBeFalsy()
  })

  it("keeps showing the last value through a refetch instead of suspending", async () => {
    const harness = renderReader("latest")
    harness.resolveFetch(0, "first")

    await waitFor(() => {
      expect(screen.getByTestId("value").textContent).toBe("first")
    })

    harness.triggerRefetch()

    // The whole point: a refetch in flight must not empty the boundary.
    await waitFor(() => {
      expect(screen.queryByTestId("fallback")).toBeFalsy()
    })
    expect(screen.getByTestId("value").textContent).toBe("first")

    harness.resolveFetch(1, "second")

    await waitFor(() => {
      expect(screen.getByTestId("value").textContent).toBe("second")
    })
  })

  it("suspends on a refetch when the accessor is called instead", async () => {
    // The bug, reproduced. Kept as the contrast that justifies `.latest`: if a
    // future version stops suspending here, this fails and the comments in
    // `blip.tsx` need revisiting.
    const harness = renderReader("accessor")
    harness.resolveFetch(0, "first")

    await waitFor(() => {
      expect(screen.getByTestId("value").textContent).toBe("first")
    })

    harness.triggerRefetch()

    await waitFor(() => {
      expect(screen.queryByTestId("fallback")).toBeTruthy()
    })
  })

  /**
   * The tests above prove which read mode is safe; this one proves the view
   * still uses it. Rendering `BlipView` for real would mean standing up the
   * router, Supabase, auth, intl, viewport, notification, confirmation and
   * composer providers around a 1200-line component, and the whole regression
   * is a single character — `query()` in place of `query.latest`. Reading the
   * source is a blunt instrument, but it is the one that actually fails when
   * someone reintroduces the bug.
   */
  it("reads both detail-page queries through .latest, never as a call", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/modules/blips/views/blip.tsx"),
      "utf8",
    )

    expect(source).toMatch(/blipGraphQuery\.latest/)
    expect(source).toMatch(/blipMediaQuery\.latest/)
    expect(source).not.toMatch(/blipGraphQuery\s*\(/)
    expect(source).not.toMatch(/blipMediaQuery\s*\(/)
  })
})
