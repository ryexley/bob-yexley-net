import { fireEvent, render, screen } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { SiteDock } from "@/modules/home/components/site-dock"
import { pages } from "@/urls"

const {
  pathname,
  isAuthenticated,
  visitorOpen,
  navigate,
} = vi.hoisted(() => ({
  pathname: { value: "/" },
  isAuthenticated: { value: true },
  visitorOpen: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock("@solidjs/router", () => ({
  useLocation: () => ({
    get pathname() {
      return pathname.value
    },
  }),
  useNavigate: () => navigate,
  A: (props: any) => (
    <a
      href={props.href}
      aria-label={props["aria-label"]}
      aria-current={props["aria-current"]}
      onClick={props.onClick}>
      {props.children}
    </a>
  ),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: () => isAuthenticated.value,
  }),
}))

vi.mock("@/modules/auth/components/visitor-auth-modal", () => ({
  useVisitorAuth: () => ({
    open: visitorOpen,
  }),
}))

vi.mock("@/modules/blips/context/blip-composer-context", () => ({
  useOptionalBlipComposer: () => ({
    activeKind: () => null,
  }),
}))

vi.mock("@/modules/home/components/user-menu", () => ({
  UserMenu: () => (
    <button
      type="button"
      aria-label="User menu">
      avatar
    </button>
  ),
}))

vi.mock("@/components/drawer", () => ({
  Drawer: (props: any) => (
    <>
      <button
        type="button"
        class={props.triggerClass}
        aria-label="Open menu"
        onClick={() => props.onOpenChange(true)}>
        menu
      </button>
      {props.open ? (
        <section data-testid="site-dock-drawer">{props.children}</section>
      ) : null}
    </>
  ),
}))

describe("SiteDock", () => {
  it("renders avatar, home, blips, and menu on the dock", () => {
    pathname.value = "/"
    isAuthenticated.value = true

    render(() => <SiteDock />)

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "User menu" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe(
      "page",
    )
    expect(screen.getByRole("link", { name: "Blips" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy()
  })

  it("keeps home current on the home Signals section", () => {
    pathname.value = "/signals"
    isAuthenticated.value = true

    render(() => <SiteDock />)

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe(
      "page",
    )
    expect(
      screen.getByRole("link", { name: "Blips" }).getAttribute("aria-current"),
    ).toBeNull()
  })

  it("marks the blips shortcut current on a blip detail page", () => {
    pathname.value = "/blips/abc"
    isAuthenticated.value = true

    render(() => <SiteDock />)

    expect(screen.getByRole("link", { name: "Blips" }).getAttribute("aria-current")).toBe(
      "page",
    )
  })

  it("opens the main nav drawer from the menu button", async () => {
    pathname.value = "/"
    isAuthenticated.value = true

    render(() => <SiteDock />)

    await fireEvent.click(screen.getByRole("button", { name: "Open menu" }))

    expect(screen.getByTestId("site-dock-drawer")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Blips" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy()
  })

  it("routes blips from the drawer through the client router", async () => {
    navigate.mockClear()
    pathname.value = "/"
    isAuthenticated.value = true

    render(() => <SiteDock />)

    await fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
    await fireEvent.click(screen.getByRole("button", { name: "Blips" }))

    expect(navigate).toHaveBeenCalledWith(pages.blips)
  })

  it("offers sign in when the user is anonymous", async () => {
    visitorOpen.mockClear()
    pathname.value = "/"
    isAuthenticated.value = false

    render(() => <SiteDock />)

    expect(screen.queryByRole("button", { name: "User menu" })).toBeNull()
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    expect(visitorOpen).toHaveBeenCalledTimes(1)
  })
})
