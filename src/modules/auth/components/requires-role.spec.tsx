import { render, screen } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  RequiresAdmin,
  RequiresRole,
  RequiresSuperUser,
} from "@/modules/auth/components/requires-role"

const authState = vi.hoisted(() => ({
  loading: false,
  role: null as "visitor" | "admin" | "superuser" | null,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    loading: () => authState.loading,
    role: () => authState.role,
  }),
}))

describe("requires-role", () => {
  beforeEach(() => {
    authState.loading = false
    authState.role = null
  })

  it("renders children when the current role is allowed", () => {
    authState.role = "admin"

    render(() => <RequiresRole roles={["visitor", "admin"]}>allowed</RequiresRole>)

    expect(screen.getByText("allowed")).toBeTruthy()
  })

  it("renders the fallback when the current role is missing", () => {
    authState.role = "visitor"

    render(() => (
      <RequiresAdmin fallback={<span>blocked</span>}>
        <span>allowed</span>
      </RequiresAdmin>
    ))

    expect(screen.queryByText("allowed")).toBeNull()
    expect(screen.getByText("blocked")).toBeTruthy()
  })

  it("only allows superusers through the superuser wrapper", () => {
    authState.role = "admin"

    render(() => <RequiresSuperUser>superuser-only</RequiresSuperUser>)

    expect(screen.queryByText("superuser-only")).toBeNull()
  })

  it("hides children while auth is still loading", () => {
    authState.loading = true
    authState.role = "superuser"

    render(() => <RequiresSuperUser>superuser-only</RequiresSuperUser>)

    expect(screen.queryByText("superuser-only")).toBeNull()
  })
})
