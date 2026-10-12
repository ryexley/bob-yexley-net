import { hydrate, renderToString } from "solid-js/web"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BlipActions } from "@/modules/blips/components/blip-actions"

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

describe("BlipActions SSR", () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {} }
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    delete (globalThis as any)._$HY
  })

  it("renders the toolbar on the server for an admin", () => {
    const html = renderToString(() => <BlipActions blip={blip} />)
    expect(html).toContain("blip-actions")
    expect(html).toContain('role="toolbar"')
  })

  it("hydrates the server's signed-in toolbar without replacing it", () => {
    const html = renderToString(() => <BlipActions blip={blip} />)
    container.innerHTML = html

    let dispose: (() => void) | undefined
    expect(() => {
      dispose = hydrate(() => <BlipActions blip={blip} />, container)
    }).not.toThrow()

    expect(container.querySelector(".blip-actions")).toBeTruthy()
    dispose?.()
  })
})
