import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileDrawer } from "@/modules/home/components/profile-drawer"

const {
  authState,
  replaceProfile,
  logout,
  updateCurrentUserDisplayName,
  updateCurrentUserAvatarVersion,
  notifySuccess,
  notifyError,
  viewportWidth,
  latestDrawerProps,
} = vi.hoisted(() => ({
  authState: {
    profile: {
      user: { id: "user-1", email: "visitor@example.com" },
      role: "visitor",
      roleCreatedAt: "2026-03-01T10:00:00.000Z",
      roleUpdatedAt: "2026-03-01T10:00:00.000Z",
      profile: {
        id: "profile-1",
        displayName: "Bob",
        avatarSeed: null,
        avatarVersion: 1,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
      system: {
        status: "active",
        failedLoginAttempts: 0,
        notes: null,
        trusted: false,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    } as any,
  },
  replaceProfile: vi.fn(),
  logout: vi.fn(async () => undefined),
  updateCurrentUserDisplayName: vi.fn(),
  updateCurrentUserAvatarVersion: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  viewportWidth: vi.fn(() => 1024),
  latestDrawerProps: {
    value: null as any,
  },
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    profile: () => authState.profile,
    user: () => authState.profile?.user ?? null,
    userProfile: () => authState.profile?.profile ?? null,
    userSystem: () => authState.profile?.system ?? null,
    role: () => authState.profile?.role ?? null,
    isAuthenticated: () => Boolean(authState.profile?.user),
    replaceProfile,
    logout,
  }),
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({
    updateCurrentUserDisplayName,
    updateCurrentUserAvatarVersion,
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

vi.mock("@/components/tooltip", () => ({
  Tooltip: (props: any) => <>{props.children}</>,
}))

vi.mock("@/components/drawer", () => ({
  DrawerPosition: {
    LEFT: "left",
    RIGHT: "right",
    TOP: "top",
    BOTTOM: "bottom",
  },
  Drawer: (props: any) => {
    latestDrawerProps.value = props
    return props.open ? (
      <section data-side={props.side}>
        <h2>{props.title}</h2>
        {props.children}
      </section>
    ) : null
  },
}))

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "home.components.userMenu.logout": "Sign Out",
      "home.components.userMenu.profileDrawer.title": "Profile",
      "home.components.userMenu.profileDrawer.actions.close": "Close",
      "home.components.userMenu.profileDrawer.actions.edit": "Edit",
      "home.components.userMenu.profileDrawer.actions.cancelEdit": "Cancel",
      "home.components.userMenu.profileDrawer.actions.regenerateAvatar":
        "Re-generate avatar colors",
      "home.components.userMenu.profileDrawer.actions.save": "Save",
      "home.components.userMenu.profileDrawer.actions.saving": "Saving...",
      "home.components.userMenu.profileDrawer.tooltips.regenerateAvatar":
        "Re-generate your icon colors. Feel free to do this as many times as you like until you get a combination and pattern that you like.",
      "home.components.userMenu.profileDrawer.fields.email": "Email",
      "home.components.userMenu.profileDrawer.fields.name": "Name",
      "home.components.userMenu.profileDrawer.fields.role": "Role",
      "home.components.userMenu.profileDrawer.fields.status": "Account Status",
      "home.components.userMenu.profileDrawer.fields.joinedAt": "Joined at",
      "home.components.userMenu.profileDrawer.values.unavailable": "Unavailable",
      "home.components.userMenu.profileDrawer.status.active": "Active",
      "home.components.userMenu.profileDrawer.status.pending": "Pending",
      "home.components.userMenu.profileDrawer.status.locked": "Locked",
      "home.components.userMenu.profileDrawer.status.visitor": "Visitor",
      "home.components.userMenu.profileDrawer.status.admin": "Admin",
      "home.components.userMenu.profileDrawer.status.superuser": "Superuser",
      "home.components.userMenu.profileDrawer.notifications.saveSuccess":
        "Profile updated.",
      "home.components.userMenu.profileDrawer.notifications.saveError":
        "Unable to update your profile right now.",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

describe("ProfileDrawer", () => {
  beforeEach(() => {
    authState.profile = {
      user: { id: "user-1", email: "visitor@example.com" },
      role: "visitor",
      roleCreatedAt: "2026-03-01T10:00:00.000Z",
      roleUpdatedAt: "2026-03-01T10:00:00.000Z",
      profile: {
        id: "profile-1",
        displayName: "Bob",
        avatarSeed: null,
        avatarVersion: 1,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
      system: {
        status: "active",
        failedLoginAttempts: 0,
        notes: null,
        trusted: false,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    } as any

    replaceProfile.mockReset()
    logout.mockReset()
    logout.mockResolvedValue(undefined)
    updateCurrentUserDisplayName.mockReset()
    updateCurrentUserAvatarVersion.mockReset()
    notifySuccess.mockReset()
    notifyError.mockReset()
    viewportWidth.mockReset()
    viewportWidth.mockReturnValue(1024)
    latestDrawerProps.value = null
  })

  it("renders the user details in read-only mode by default", () => {
    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    expect(screen.getByText("Profile")).toBeTruthy()
    expect(screen.getAllByText("visitor@example.com").length).toBeGreaterThan(0)
    expect(screen.getByText("Bob")).toBeTruthy()
    expect(screen.getByText("Email:")).toBeTruthy()
    expect(screen.getByText("Role:")).toBeTruthy()
    expect(screen.getByText("Visitor")).toBeTruthy()
    expect(screen.getByText("Account Status:")).toBeTruthy()
    expect(screen.getByText("Active")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy()
  })

  it("shows the privileged role badge and role label for admins", () => {
    authState.profile = {
      ...authState.profile,
      role: "admin",
    } as any

    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    expect(screen.getByText("Admin")).toBeTruthy()
    expect(screen.getByText("shield_person")).toBeTruthy()
  })

  it("uses the right-side drawer on tablet and desktop widths", () => {
    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    expect(screen.getByText("Profile").closest("section")?.getAttribute("data-side")).toBe(
      "right",
    )
  })

  it("uses the bottom drawer on phone widths", () => {
    viewportWidth.mockReturnValue(375)

    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    expect(screen.getByText("Profile").closest("section")?.getAttribute("data-side")).toBe(
      "bottom",
    )
  })

  it("enables editing and saves a new display name", async () => {
    updateCurrentUserDisplayName.mockResolvedValue({
      data: {
        ...authState.profile,
        profile: {
          ...authState.profile.profile,
          displayName: "Bobby",
        },
      },
      error: null,
    })

    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    await fireEvent.click(screen.getByRole("button", { name: "Edit" }))

    expect(screen.getByText("Email:")).toBeTruthy()
    expect(screen.getAllByText("visitor@example.com").length).toBeGreaterThan(0)
    const nameInput = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement

    await fireEvent.input(nameInput, { target: { value: "Bobby" } })
    await fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(updateCurrentUserDisplayName).toHaveBeenCalledWith("Bobby")
    })
    expect(replaceProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          displayName: "Bobby",
        }),
      }),
    )
    expect(notifySuccess).toHaveBeenCalled()
  })

  it("regenerates avatar colors by incrementing avatar version", async () => {
    updateCurrentUserAvatarVersion.mockResolvedValue({
      data: {
        ...authState.profile,
        profile: {
          ...authState.profile.profile,
          avatarVersion: 2,
        },
      },
      error: null,
    })

    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    await fireEvent.click(
      screen.getByRole("button", { name: "Re-generate avatar colors" }),
    )

    await waitFor(() => {
      expect(updateCurrentUserAvatarVersion).toHaveBeenCalledWith(2)
    })
    expect(replaceProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          avatarVersion: 2,
        }),
      }),
    )
  })

  it("closes from the close button", async () => {
    const onOpenChange = vi.fn()

    render(() => <ProfileDrawer open onOpenChange={onOpenChange} />)

    await fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("uses manual dismiss handling while keeping the desktop drawer non-snapping", () => {
    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    expect(latestDrawerProps.value.drawerProps).toMatchObject({
      closeOnEscapeKeyDown: false,
      closeOnOutsidePointer: false,
      closeOnOutsideFocus: false,
      snapPoints: [1],
      breakPoints: [],
      defaultSnapPoint: 1,
    })
  })

  it("disables implicit dismiss controls while editing", async () => {
    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    await fireEvent.click(screen.getByRole("button", { name: "Edit" }))

    expect(latestDrawerProps.value.drawerProps).toMatchObject({
      closeOnEscapeKeyDown: false,
      closeOnOutsidePointer: false,
      closeOnOutsideFocus: false,
    })
  })

  it("logs out from the drawer", async () => {
    render(() => <ProfileDrawer open onOpenChange={() => undefined} />)

    await fireEvent.click(screen.getByRole("button", { name: "Sign Out" }))

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1)
    })
  })
})
