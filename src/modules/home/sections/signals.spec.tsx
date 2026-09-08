import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { Signals } from "@/modules/home/sections/signals"

vi.mock("@solidjs/router", () => ({
  createAsync: () => () => [],
  useNavigate: () => vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: () => false,
  }),
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({ client: {} }),
}))

vi.mock("@/modules/blips/data", () => ({
  blipStore: () => ({
    entities: () => [],
    setInitialData: vi.fn(),
  }),
  getBlips: vi.fn(),
}))

vi.mock("@/modules/blips/components/blips", () => ({
  Blips: () => <ul data-testid="signals-blips" />,
}))

describe("Signals heading chrome", () => {
  it("uses the same Blips tagline and logo mark as the /blips page", () => {
    render(() => <Signals />)

    const heading = document.querySelector("h2.blips-page-heading")
    expect(heading?.textContent).toBe(
      "moments, thoughts and updates — just Blips on the radar",
    )
    expect(heading?.querySelector(".blips-page-heading-mark")?.textContent).toBe(
      "Blips",
    )

    const section = heading?.closest("section")
    expect(section?.classList.contains("signals")).toBe(true)
    expect(section?.classList.contains("blips-index")).toBe(true)
    expect(section?.querySelector(".blips-index-mark")?.getAttribute("aria-hidden")).toBe(
      "true",
    )
  })
})
