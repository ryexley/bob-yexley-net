import { render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UsersView } from "@/modules/users/views"
import type { AdminUserRecord, AdminUsersQueryResult } from "@/modules/users/data/types"

const {
  authState,
  replaceProfile,
  navigate,
  adminUsersResult,
  latestUserEditDrawerProps,
} = vi.hoisted(() => ({
  authState: {
    profile: {
      user: { id: "user-1", email: "bob@yexley.net" },
      role: "superuser",
      roleCreatedAt: "2026-03-01T10:00:00.000Z",
      roleUpdatedAt: "2026-03-01T10:00:00.000Z",
      visitor: {
        id: "visitor-1",
        displayName: "Bob Yexley",
        status: "active",
        failedLoginAttempts: 0,
        notes: "owner",
        createdAt: "2026-03-29T03:42:00.000Z",
      },
    } as any,
  },
  replaceProfile: vi.fn(),
  navigate: vi.fn(),
  adminUsersResult: {
    value: {
      authorized: true,
      users: [
        {
          userId: "user-1",
          visitorId: "visitor-1",
          role: "superuser",
          email: "bob@yexley.net",
          displayName: "Bob Yexley",
          status: "active",
          notes: "owner",
          createdAt: "2026-03-29T03:42:00.000Z",
        },
        {
          userId: "user-2",
          visitorId: "visitor-2",
          role: "visitor",
          email: "crystal@yexley.net",
          displayName: "Crystal",
          status: "pending",
          notes: null,
          createdAt: "2026-03-30T21:01:00.000Z",
        },
      ],
      error: null,
    } as AdminUsersQueryResult,
  },
  latestUserEditDrawerProps: {
    value: null as any,
  },
}))

vi.mock("@solidjs/router", () => ({
  createAsync: () => () => adminUsersResult.value,
  useNavigate: () => navigate,
  query: (fn: unknown) => fn,
}))

vi.mock("@solidjs/meta", () => ({
  Title: () => null,
  Meta: () => null,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    profile: () => authState.profile,
    user: () => authState.profile?.user ?? null,
    visitor: () => authState.profile?.visitor ?? null,
    role: () => authState.profile?.role ?? null,
    loading: () => false,
    replaceProfile,
    logout: vi.fn(),
    isAuthenticated: () => Boolean(authState.profile?.user),
    isAdmin: () =>
      authState.profile?.role === "admin" || authState.profile?.role === "superuser",
    isSuperuser: () => authState.profile?.role === "superuser",
  }),
}))

vi.mock("@/components/button", () => ({
  Button: (props: any) => (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}>
      {props.label}
    </button>
  ),
}))

vi.mock("@/components/icon", () => ({
  Icon: (props: any) => <span>{props.name}</span>,
  LoadingSpinner: () => <span>loading</span>,
}))

vi.mock("@/components/input", () => ({
  Input: (props: any) => (
    <label>
      <span>{props.label}</span>
      <input
        value={props.value ?? ""}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        onInput={props.onInput}
      />
    </label>
  ),
}))

vi.mock("@/components/select", () => ({
  Select: () => <div>sort-select</div>,
}))

vi.mock("@/components/stack", () => ({
  Stack: (props: any) => <div>{props.children}</div>,
}))

vi.mock("@/modules/users/components/user-avatar", () => ({
  UserAvatar: () => <span>avatar</span>,
}))

vi.mock("@/modules/users/components/user-status-segmented-control", () => ({
  UserStatusSegmentedControl: (props: any) => <div>{props.label ?? "status-filter"}</div>,
}))

vi.mock("@/modules/users/components/user-edit-drawer", () => ({
  UserEditDrawer: (props: any) => {
    latestUserEditDrawerProps.value = props
    return props.open ? <div data-testid="user-edit-drawer">open</div> : null
  },
}))

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "users.views.index.pageTitle": "Users",
      "users.views.index.metaDescription": "Admin user management",
      "users.views.index.title": "Users",
      "users.views.index.subtitle": "Manage users",
      "users.views.index.loading": "Loading users...",
      "users.views.index.summary": "Showing users",
      "users.views.index.actions.backToAdmin": "admin",
      "users.views.index.actions.showFilters": "Show filters",
      "users.views.index.actions.hideFilters": "Hide filters",
      "users.views.index.actions.clearFilters": "Clear filters",
      "users.views.index.sort.fieldLabel": "Sort by",
      "users.views.index.sort.fields.createdAt": "Created date",
      "users.views.index.sort.fields.displayName": "Name",
      "users.views.index.sort.direction.asc": "Ascending",
      "users.views.index.sort.direction.desc": "Descending",
      "users.views.index.filters.search.label": "Search",
      "users.views.index.filters.search.placeholder": "Search by name or email",
      "users.views.index.filters.status.label": "Status",
      "users.views.index.fields.joinedAt": "Joined",
      "users.views.index.empty.noUsers": "No users yet.",
      "users.views.index.empty.noMatches": "No users match the current filters.",
      "users.views.index.values.unavailable": "Unavailable",
      "users.shared.statuses.pending": "Pending",
      "users.shared.statuses.active": "Active",
      "users.shared.statuses.locked": "Locked",
      "users.shared.statuses.all": "All",
      "users.shared.roles.visitor": "Visitor",
      "users.shared.roles.admin": "Admin",
      "users.shared.roles.superuser": "Superuser",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

vi.mock("@/urls", () => ({
  pages: {
    admin: "/a",
    home: "/",
    login: "/a/li",
  },
}))

vi.mock("@/util/browser", () => ({
  windowTitle: (value: string) => value,
}))

vi.mock("@/util/formatters", () => ({
  formatLongDate: (value: string) => `formatted:${value}`,
}))

describe("UsersView", () => {
  beforeEach(() => {
    authState.profile = {
      user: { id: "user-1", email: "bob@yexley.net" },
      role: "superuser",
      roleCreatedAt: "2026-03-01T10:00:00.000Z",
      roleUpdatedAt: "2026-03-01T10:00:00.000Z",
      visitor: {
        id: "visitor-1",
        displayName: "Bob Yexley",
        status: "active",
        failedLoginAttempts: 0,
        notes: "owner",
        createdAt: "2026-03-29T03:42:00.000Z",
      },
    } as any

    adminUsersResult.value = {
      authorized: true,
      users: [
        {
          userId: "user-1",
          visitorId: "visitor-1",
          role: "superuser",
          email: "bob@yexley.net",
          displayName: "Bob Yexley",
          status: "active",
          notes: "owner",
          createdAt: "2026-03-29T03:42:00.000Z",
        },
        {
          userId: "user-2",
          visitorId: "visitor-2",
          role: "visitor",
          email: "crystal@yexley.net",
          displayName: "Crystal",
          status: "pending",
          notes: null,
          createdAt: "2026-03-30T21:01:00.000Z",
        },
      ],
      error: null,
    }
    replaceProfile.mockReset()
    navigate.mockReset()
    latestUserEditDrawerProps.value = null
  })

  it("updates the saved user in the rendered list", async () => {
    render(() => <UsersView />)

    const updatedUser: AdminUserRecord = {
      userId: "user-2",
      visitorId: "visitor-2",
      role: "admin",
      email: "crystal@yexley.net",
      displayName: "Crystal",
      status: "locked",
      notes: "updated",
      createdAt: "2026-03-30T21:01:00.000Z",
    }

    latestUserEditDrawerProps.value.onSaved(updatedUser)

    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy()
      expect(screen.getByText("Locked")).toBeTruthy()
    })

    expect(replaceProfile).not.toHaveBeenCalled()
  })

  it("updates the auth profile cache when saving the current user", async () => {
    render(() => <UsersView />)

    const updatedUser: AdminUserRecord = {
      userId: "user-1",
      visitorId: "visitor-1",
      role: "admin",
      email: "bob@yexley.net",
      displayName: "Bob Yexley",
      status: "locked",
      notes: "new internal note",
      createdAt: "2026-03-29T03:42:00.000Z",
    }

    latestUserEditDrawerProps.value.onSaved(updatedUser)

    await waitFor(() => {
      expect(replaceProfile).toHaveBeenCalledWith({
        ...authState.profile,
        role: "admin",
        visitor: {
          ...authState.profile.visitor,
          id: "visitor-1",
          displayName: "Bob Yexley",
          status: "locked",
          notes: "new internal note",
          createdAt: "2026-03-29T03:42:00.000Z",
        },
      })
    })
  })
})
