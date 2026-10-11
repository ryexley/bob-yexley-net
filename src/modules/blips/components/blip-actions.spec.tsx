import { hydrate } from "solid-js/web"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BlipActions } from "@/modules/blips/components/blip-actions"

// Signed in as superuser on the client. The server always renders signed out
// (auth is applied in an effect), which is what made the home page crash.
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: () => true,
    isSuperuser: () => true,
    user: () => ({ id: "user-1" }),
  }),
}))
vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({ client: {} }),
}))
vi.mock("@/components/confirm-dialog", () => ({ useConfirm: () => vi.fn() }))
vi.mock("@/modules/blips/data", () => ({ blipStore: () => ({}) }))

const blip = { id: "b1", user_id: "user-1", published: true } as any

describe("BlipActions hydration", () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {} }
    container = document.createElement("div")
    // What the server sent: no toolbar.
    container.innerHTML = ""
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    delete (globalThis as any)._$HY
  })

  it("hydrates the server's signed-out markup, then shows the toolbar once mounted", async () => {
    let dispose: (() => void) | undefined
    expect(() => {
      dispose = hydrate(() => <BlipActions blip={blip} />, container)
    }).not.toThrow()

    await Promise.resolve()
    expect(container.querySelector(".blip-actions")).toBeTruthy()
    dispose?.()
  })
})
