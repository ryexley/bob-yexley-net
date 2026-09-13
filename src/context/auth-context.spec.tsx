import { render, screen, waitFor } from "@solidjs/testing-library"
import { createEffect, createSignal } from "solid-js"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { AuthProvider, useAuth } from "@/context/auth-context"
import { TIME } from "@/util/enums"

const initialProfileState = vi.hoisted(() => ({
  value: null as any,
}))

const sessionProfile = {
  user: {
    id: "user-1",
    email: "bob@example.com",
  },
  role: "visitor",
  roleCreatedAt: null,
  roleUpdatedAt: null,
  profile: {
    id: "profile-1",
    displayName: "Bob",
    avatarSeed: null,
    avatarVersion: null,
    createdAt: null,
    updatedAt: null,
  },
  system: {
    status: "active",
    failedLoginAttempts: 0,
    notes: null,
    trusted: true,
    createdAt: null,
    updatedAt: null,
  },
}

const authMockState = vi.hoisted(() => {
  let handler:
    | ((
        event: string,
        session: { user: { id: string; email: string } } | null,
      ) => void)
    | null = null

  return {
    openCurrentSession: vi.fn(async () => ({
      data: null,
      error: null as string | null,
    })),
    isServerSessionValid: vi.fn(async () => ({
      data: true as boolean | null,
      error: null as string | null,
    })),
    logout: vi.fn(async () => {}),
    getUserProfile: vi.fn(async () => ({ data: sessionProfile, error: null })),
    setHandler(next: typeof handler) {
      handler = next
    },
    emit(
      event: string,
      session: { user: { id: string; email: string } } | null,
    ) {
      handler?.(event, session)
    },
  }
})

vi.mock("@solidjs/router", () => ({
  createAsync: () => () => initialProfileState.value,
}))

vi.mock("@/modules/auth/data/queries", () => ({
  getUserProfile: async () => initialProfileState.value,
}))

vi.mock("@/modules/auth/components/visitor-auth-modal", () => ({
  setVisitorAuthenticateHandler: vi.fn(),
}))

vi.mock("@/lib/vendor/supabase/browser", () => ({
  supabase: {
    visitorSignUp: vi.fn(),
    visitorLogin: vi.fn(),
    getUser: vi.fn(async () => ({
      data: { id: "user-1", email: "bob@example.com" },
      error: null,
    })),
    isSessionExpired: vi.fn(() => false),
    isServerSessionValid: authMockState.isServerSessionValid,
    logout: authMockState.logout,
    getUserProfile: authMockState.getUserProfile,
    peekUserProfile: vi.fn(() => null),
    openCurrentSession: authMockState.openCurrentSession,
    markSessionStartIfMissing: vi.fn(),
    clearSessionStart: vi.fn(),
    client: {
      auth: {
        onAuthStateChange: (callback: typeof authMockState.emit) => {
          authMockState.setHandler(callback as any)
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          }
        },
      },
    },
  },
}))

function AuthStatusProbe() {
  const auth = useAuth()
  const [readyOnce, setReadyOnce] = createSignal(false)
  const [reenteredLoading, setReenteredLoading] = createSignal(false)
  const [busyPulses, setBusyPulses] = createSignal(0)
  let wasBusy = false

  createEffect(() => {
    if (!auth.loading()) {
      setReadyOnce(true)
    } else if (readyOnce()) {
      setReenteredLoading(true)
    }

    const isBusy = auth.busy()
    if (isBusy && !wasBusy) {
      setBusyPulses(count => count + 1)
    }
    wasBusy = isBusy
  })

  return (
    <>
      <div data-testid="auth-state">
        {auth.isAuthenticated() ? "authenticated" : "anonymous"}
      </div>
      <div data-testid="display-name">
        {auth.userProfile()?.displayName ?? ""}
      </div>
      <div data-testid="auth-loading">
        {auth.loading() ? "loading" : "ready"}
      </div>
      <div data-testid="auth-busy">{auth.busy() ? "busy" : "idle"}</div>
      <div data-testid="auth-flicker">
        {reenteredLoading() ? "flickered" : "stable"}
      </div>
      <div data-testid="auth-busy-pulses">{busyPulses()}</div>
    </>
  )
}

describe("AuthProvider", () => {
  it("throws when useAuth is used outside AuthProvider", () => {
    expect(() => {
      render(() => {
        useAuth()
        return null
      })
    }).toThrow("useAuth must be used within an AuthProvider")
  })

  beforeEach(() => {
    initialProfileState.value = null
    authMockState.openCurrentSession.mockClear()
    authMockState.getUserProfile.mockClear()
    authMockState.logout.mockClear()
    authMockState.isServerSessionValid.mockClear()
    // Re-seed a healthy session so a test that breaks one of these describes
    // only its own failure.
    authMockState.openCurrentSession.mockImplementation(async () => ({
      data: null,
      error: null,
    }))
    authMockState.isServerSessionValid.mockImplementation(async () => ({
      data: true,
      error: null,
    }))
  })

  it("hydrates an existing initial browser session", async () => {
    render(() => (
      <AuthProvider>
        <AuthStatusProbe />
      </AuthProvider>
    ))

    expect(screen.getByTestId("auth-state").textContent).toBe("anonymous")

    authMockState.emit("INITIAL_SESSION", {
      user: { id: "user-1", email: "bob@example.com" },
    })

    await waitFor(() => {
      expect(screen.getByTestId("auth-state").textContent).toBe("authenticated")
    })

    expect(screen.getByTestId("display-name").textContent).toBe("Bob")
    expect(authMockState.openCurrentSession).toHaveBeenCalled()
    expect(authMockState.getUserProfile).toHaveBeenCalled()
  })

  it("reopens the server session after a token refresh", async () => {
    render(() => (
      <AuthProvider>
        <AuthStatusProbe />
      </AuthProvider>
    ))

    authMockState.emit("INITIAL_SESSION", {
      user: { id: "user-1", email: "bob@example.com" },
    })

    await waitFor(() => {
      expect(screen.getByTestId("auth-state").textContent).toBe("authenticated")
      expect(screen.getByTestId("auth-busy").textContent).toBe("idle")
    })

    const pulsesBeforeRefresh = Number(
      screen.getByTestId("auth-busy-pulses").textContent,
    )
    authMockState.openCurrentSession.mockClear()
    authMockState.getUserProfile.mockClear()

    authMockState.emit("TOKEN_REFRESHED", {
      user: { id: "user-1", email: "bob@example.com" },
    })

    await waitFor(() => {
      expect(authMockState.openCurrentSession).toHaveBeenCalled()
    })

    expect(screen.getByTestId("auth-state").textContent).toBe("authenticated")
    expect(screen.getByTestId("display-name").textContent).toBe("Bob")
    expect(screen.getByTestId("auth-loading").textContent).toBe("ready")
    expect(screen.getByTestId("auth-flicker").textContent).toBe("stable")
    expect(
      Number(screen.getByTestId("auth-busy-pulses").textContent),
    ).toBeGreaterThan(pulsesBeforeRefresh)
    expect(screen.getByTestId("auth-busy").textContent).toBe("idle")
  })

  describe("resuming a backgrounded tab", () => {
    const mountAndSignIn = async () => {
      render(() => (
        <AuthProvider>
          <AuthStatusProbe />
        </AuthProvider>
      ))

      authMockState.emit("INITIAL_SESSION", {
        user: { id: "user-1", email: "bob@example.com" },
      })

      await waitFor(() => {
        expect(screen.getByTestId("auth-state").textContent).toBe(
          "authenticated",
        )
      })
    }

    /** The phone coming back out of a pocket, past the one second debounce. */
    const resumeTab = async () => {
      vi.useFakeTimers()
      try {
        window.dispatchEvent(new Event("focus"))
        await vi.advanceTimersByTimeAsync(TIME.ONE_SECOND)
      } finally {
        vi.useRealTimers()
      }
    }

    /**
     * Regression for repeated sign-outs while posting live updates from a
     * stadium. Every resume revalidates against Postgres, and on a congested
     * network those calls fail — which used to be read as a rejected session
     * and trigger a real logout, revoking the session row and clearing the
     * Supabase cookies.
     */
    it("stays signed in when the revalidation cannot reach the server", async () => {
      await mountAndSignIn()

      authMockState.openCurrentSession.mockClear()
      authMockState.openCurrentSession.mockImplementation(async () => ({
        data: null,
        error: "TypeError: Failed to fetch",
      }))

      await resumeTab()

      await waitFor(() => {
        expect(authMockState.openCurrentSession).toHaveBeenCalled()
      })

      expect(authMockState.logout).not.toHaveBeenCalled()
      expect(screen.getByTestId("auth-state").textContent).toBe("authenticated")
      expect(screen.getByTestId("display-name").textContent).toBe("Bob")
    })

    it("signs out when the server reports the session is no longer valid", async () => {
      // The counterpart to the test above: a session revoked from another
      // device still has to end, or the tolerance added for flaky networks
      // would keep a dead session alive.
      await mountAndSignIn()

      authMockState.isServerSessionValid.mockImplementation(async () => ({
        data: false,
        error: null,
      }))

      await resumeTab()

      await waitFor(() => {
        expect(screen.getByTestId("auth-state").textContent).toBe("anonymous")
      })

      expect(authMockState.logout).toHaveBeenCalled()
    })
  })
})
