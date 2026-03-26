import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserMenu } from "@/modules/home/components/user-menu"

const {
  authState,
  replaceProfile,
  logout,
  updateCurrentVisitorDisplayName,
  notifySuccess,
  notifyError,
  viewportWidth,
} = vi.hoisted(() => ({
  authState: {
    profile: {
      user: { id: "user-1", email: "visitor@example.com" },
      role: "visitor",
      roleCreatedAt: "2026-03-01T10:00:00.000Z",
      roleUpdatedAt: "2026-03-01T10:00:00.000Z",
      visitor: {
        id: "visitor-1",
        displayName: "Bob",
        status: "active",
        failedLoginAttempts: 0,
        notes: null,
        createdAt: "2026-03-01T10:00:00.000Z",
      },
    } as any,
  },
  replaceProfile: vi.fn(),
  logout: vi.fn(async () => undefined),
  updateCurrentVisitorDisplayName: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  viewportWidth: vi.fn(() => 1024),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    profile: () => authState.profile,
    user: () => authState.profile?.user ?? null,
    visitor: () => authState.profile?.visitor ?? null,
    role: () => authState.profile?.role ?? null,
    isAuthenticated: () => Boolean(authState.profile?.user),
    isAdmin: () =>
      authState.profile?.role === "admin" || authState.profile?.role === "superuser",
    isSuperuser: () => authState.profile?.role === "superuser",
    replaceProfile,
    logout,
  }),
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({
    updateCurrentVisitorDisplayName,
  }),
}))

vi.mock("@/context/viewport", () => ({
  useViewport: () => ({
    width: viewportWidth,
  }),
}))

vi.mock("@/components/notification", () => ({
  useNotify: () => ({
    success: notifySuccess,
    error: notifyError,
  }),
}))

vi.mock("@/components/menu", () => ({
  Menu: (props: any) => (
    <div>
      <button type="button" aria-label="User menu">
        trigger
      </button>
      <div>{props.Header ? props.Header() : null}</div>
      <div>
        {props.items.map((item: any) => (
          <button type="button" onClick={() => item.onClick()}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  ),
}))

vi.mock("@/components/drawer", () => ({
  Drawer: (props: any) =>
    <>
      {props.open && (
        <section data-testid="mobile-user-menu" data-side={props.side}>
          {props.children}
        </section>
      )}
    </>,
}))

vi.mock("@/modules/home/components/profile-drawer", () => ({
  ProfileDrawer: (props: any) =>
    <>{props.open && <div data-testid="profile-drawer">Profile drawer</div>}</>,
}))

vi.mock("~/modules/blips/components/blip-editor", () => ({
  BlipEditor: (props: any) =>
    <>{props.open && <div data-testid="blip-editor">Blip editor</div>}</>,
}))

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "home.components.userMenu.header.label": "Signed in as",
      "home.components.userMenu.profile": "Profile",
      "home.components.userMenu.blip": "Blip",
      "home.components.userMenu.logout": "Sign Out",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

describe("UserMenu", () => {
  beforeEach(() => {
    authState.profile = {
      user: { id: "user-1", email: "visitor@example.com" },
      role: "visitor",
      roleCreatedAt: "2026-03-01T10:00:00.000Z",
      roleUpdatedAt: "2026-03-01T10:00:00.000Z",
      visitor: {
        id: "visitor-1",
        displayName: "Bob",
        status: "active",
        failedLoginAttempts: 0,
        notes: null,
        createdAt: "2026-03-01T10:00:00.000Z",
      },
    } as any

    replaceProfile.mockReset()
    logout.mockReset()
    logout.mockResolvedValue(undefined)
    updateCurrentVisitorDisplayName.mockReset()
    notifySuccess.mockReset()
    notifyError.mockReset()
    viewportWidth.mockReset()
    viewportWidth.mockReturnValue(1024)
  })

  it("does not render for signed-out users", () => {
    authState.profile = null

    render(() => <UserMenu />)

    expect(screen.queryByLabelText("User menu")).toBeNull()
    expect(screen.queryByRole("button", { name: "Profile" })).toBeNull()
  })

  it("shows the profile item for visitors without the blip action", () => {
    render(() => <UserMenu />)

    expect(screen.getByRole("button", { name: "Profile" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Blip" })).toBeNull()
  })

  it("shows the blip action for admins", () => {
    authState.profile = {
      ...authState.profile,
      role: "admin",
    } as any

    render(() => <UserMenu />)

    expect(screen.getByRole("button", { name: "Profile" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Blip" })).toBeTruthy()
  })

  it("opens the profile drawer from the profile menu item", async () => {
    render(() => <UserMenu />)

    await fireEvent.click(screen.getByRole("button", { name: "Profile" }))

    expect(screen.getByTestId("profile-drawer")).toBeTruthy()
  })

  it("shows sign out as a desktop menu item and triggers logout", async () => {
    render(() => <UserMenu />)

    await fireEvent.click(screen.getByRole("button", { name: "Sign Out" }))

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1)
    })
  })

  it("uses a mobile bottom drawer menu on small viewports", async () => {
    viewportWidth.mockReturnValue(375)

    render(() => <UserMenu />)

    expect(screen.queryByRole("button", { name: "Profile" })).toBeNull()

    await fireEvent.click(screen.getByRole("button", { name: "User menu" }))

    expect(screen.getByTestId("mobile-user-menu")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Profile" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy()
  })

  it("opens the profile drawer from the mobile menu", async () => {
    viewportWidth.mockReturnValue(375)

    render(() => <UserMenu />)

    await fireEvent.click(screen.getByRole("button", { name: "User menu" }))
    await fireEvent.click(screen.getByRole("button", { name: "Profile" }))

    expect(screen.getByTestId("profile-drawer")).toBeTruthy()
  })

  it("opens the blip editor from the admin blip menu item", async () => {
    authState.profile = {
      ...authState.profile,
      role: "admin",
    } as any

    render(() => <UserMenu />)

    await fireEvent.click(screen.getByRole("button", { name: "Blip" }))

    await waitFor(() => {
      expect(screen.getByTestId("blip-editor")).toBeTruthy()
    })
  })

  it("opens the blip editor from the mobile admin menu", async () => {
    viewportWidth.mockReturnValue(375)
    authState.profile = {
      ...authState.profile,
      role: "admin",
    } as any

    render(() => <UserMenu />)

    await fireEvent.click(screen.getByRole("button", { name: "User menu" }))
    await fireEvent.click(screen.getByRole("button", { name: "Blip" }))

    await waitFor(() => {
      expect(screen.getByTestId("blip-editor")).toBeTruthy()
    })
  })
})
