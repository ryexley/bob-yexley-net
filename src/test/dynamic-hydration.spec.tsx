import { sharedConfig } from "solid-js"
import { hydrate, Dynamic } from "solid-js/web"
import { Button as KobalteButton } from "@kobalte/core/button"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

/**
 * Regression for the production-only `t is not a function. (In 't()', 't' is
 * undefined)` route crash.
 *
 * Solid's `<Dynamic component="tag">` (which every Kobalte polymorphic
 * component, e.g. our `Button`, renders through) calls `getNextElement()` with
 * no template while hydrating. When the client renders a node the server did
 * not (auth resolved on the client after an anonymous SSR, a streamed Suspense
 * boundary hydrating late, ...), the hydration-key lookup misses and Solid
 * falls back to calling that missing template: `template()` minifies to `t()`.
 * `patches/solid-js@1.9.15.patch` passes a real element factory instead.
 */
describe("Dynamic string components during hydration", () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {} }
    container = document.createElement("div")
    // Server HTML that has no node for the component the client is about to render.
    container.innerHTML = "<span>server</span>"
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    delete (globalThis as any)._$HY
  })

  it("creates a fresh element when a Dynamic tag renders after hydration finished", () => {
    // A streamed Suspense boundary can resolve after the document finished
    // hydrating: the hydration context is still set but `done` is true, so
    // production Solid skips the registry and calls the (missing) template.
    const Late = () => {
      sharedConfig.done = true
      return <Dynamic component="button" class="late">late</Dynamic>
    }
    let dispose: (() => void) | undefined
    expect(() => {
      dispose = hydrate(() => <Late />, container)
    }).not.toThrow()
    expect(container.querySelector("button.late")?.textContent).toBe("late")
    dispose?.()
  })

  it("lets a Kobalte button render into a hydration mismatch", () => {
    let dispose: (() => void) | undefined
    expect(() => {
      dispose = hydrate(() => <KobalteButton>Edit</KobalteButton>, container)
    }).not.toThrow()
    expect(container.querySelector("button")?.textContent).toBe("Edit")
    dispose?.()
  })
})
