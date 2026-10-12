import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { useAuth } from "@/context/auth-context"

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
  it("renders the toolbar on the server for an admin", () => {
    let showToolbarOnFirstPaint = false

    function FirstPaint() {
      const { isAuthenticated, isSuperuser } = useAuth()
      showToolbarOnFirstPaint = isAuthenticated() && isSuperuser()
      return <BlipActions blip={blip} />
    }

    const { container } = render(() => <FirstPaint />)

    expect(showToolbarOnFirstPaint).toBe(true)
    expect(container.querySelector(".blip-actions")).toBeTruthy()
    expect(container.querySelector('[role="toolbar"]')).toBeTruthy()
  })
})
