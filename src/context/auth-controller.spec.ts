import { describe, expect, it, vi } from "vitest"
import {
  bootstrapAuthSession,
  buildFallbackProfile,
  isHollowAuthProfile,
  loadAuthProfile,
  resolveSignedInAuth,
} from "@/context/auth-controller"
import type { UserProfile } from "@/lib/vendor/supabase/browser"

const userProfile: UserProfile = {
  user: { id: "user-1", email: "user@example.com" },
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
    status: "pending",
    failedLoginAttempts: 0,
    notes: null,
    trusted: null,
    createdAt: null,
    updatedAt: null,
  },
}

const hollowProfile = buildFallbackProfile({
  id: "user-1",
  email: "user@example.com",
})

const sessionUser = { id: "user-1", email: "user@example.com" }

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

type BootstrapDeps = Parameters<typeof bootstrapAuthSession>[0]

/**
 * Defaults describe a healthy session, so each test overrides only the
 * dependency whose failure it is actually about.
 */
const bootstrapDeps = (
  overrides: Partial<BootstrapDeps> = {},
): BootstrapDeps => ({
  getUser: async () => ({ data: sessionUser, error: null }),
  isSessionExpired: () => false,
  markSessionStartIfMissing: () => undefined,
  openCurrentSession: async () => ({ data: null, error: null }),
  isServerSessionValid: async () => ({ data: true, error: null }),
  logout: async () => undefined,
  loadUserProfile: async () => userProfile,
  ...overrides,
})

describe("auth-controller", () => {
  it("builds a visitor fallback profile", () => {
    expect(hollowProfile).toMatchObject({
      user: { id: "user-1", email: "user@example.com" },
      role: "visitor",
      profile: { id: null },
      system: { status: null },
    })
    expect(isHollowAuthProfile(hollowProfile)).toBe(true)
    expect(isHollowAuthProfile(userProfile)).toBe(false)
  })

  it("returns null when profile lookup fails", async () => {
    const profile = await loadAuthProfile(
      { id: "user-1", email: "user@example.com" },
      async () => ({ data: null, error: "boom" }),
    )

    expect(profile).toBeNull()
  })

  it("bootstraps an authenticated profile when client and server sessions are valid", async () => {
    const loadUserProfile = vi.fn(async () => userProfile)
    const openCurrentSession = vi.fn(async () => ({ data: null, error: null }))

    const result = await bootstrapAuthSession(
      bootstrapDeps({ openCurrentSession, loadUserProfile }),
    )

    expect(openCurrentSession).toHaveBeenCalledTimes(1)
    expect(loadUserProfile).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: userProfile, shouldLogout: false })
  })

  it("logs out on bootstrap when the local session is expired", async () => {
    const logout = vi.fn(async () => undefined)

    const result = await bootstrapAuthSession(
      bootstrapDeps({ isSessionExpired: () => true, logout }),
    )

    expect(logout).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: null, shouldLogout: true })
  })

  it("logs out on bootstrap when the healed profile is hollow", async () => {
    const logout = vi.fn(async () => undefined)

    const result = await bootstrapAuthSession(
      bootstrapDeps({ loadUserProfile: async () => hollowProfile, logout }),
    )

    expect(logout).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: null, shouldLogout: true })
  })

  it("reuses a cached live profile on sign-in transitions", async () => {
    const result = await resolveSignedInAuth({
      sessionUser: { id: "user-1", email: "user@example.com" },
      currentUserId: null,
      currentRole: null,
      currentProfileId: null,
      cachedProfile: userProfile,
      openCurrentSession: async () => ({ data: null, error: null }),
      markSessionStartIfMissing: () => undefined,
      logout: async () => undefined,
      loadUserProfile: async () => {
        throw new Error("should not run")
      },
    })

    expect(result).toEqual({ profile: userProfile, shouldLogout: false })
  })

  it("does not reuse a hollow cached profile", async () => {
    const openCurrentSession = vi.fn(async () => ({ data: null, error: null }))
    const loadUserProfile = vi.fn(async () => userProfile)

    const result = await resolveSignedInAuth({
      sessionUser: { id: "user-1", email: "user@example.com" },
      currentUserId: "user-1",
      currentRole: "visitor",
      currentProfileId: null,
      cachedProfile: hollowProfile,
      openCurrentSession,
      markSessionStartIfMissing: () => undefined,
      logout: async () => undefined,
      loadUserProfile,
    })

    expect(openCurrentSession).toHaveBeenCalledTimes(1)
    expect(loadUserProfile).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: userProfile, shouldLogout: false })
  })

  it("keeps the session when starting the server session fails during sign-in", async () => {
    // This used to log out. The path runs on every `INITIAL_SESSION`, so a cold
    // start on a bad connection signed a returning user out before they had
    // touched anything.
    const logout = vi.fn(async () => undefined)

    const result = await resolveSignedInAuth({
      sessionUser,
      currentUserId: null,
      currentRole: null,
      currentProfileId: null,
      cachedProfile: null,
      openCurrentSession: async () => ({ data: null, error: "nope" }),
      markSessionStartIfMissing: () => undefined,
      logout,
      loadUserProfile: async () => userProfile,
    })

    expect(logout).not.toHaveBeenCalled()
    expect(result).toEqual({ profile: null, shouldLogout: false })
  })

  describe("an unreachable server is not a signed-out user", () => {
    /**
     * Regression: posting live updates from a stadium, the author was signed
     * out roughly half a dozen times over one evening. This revalidation runs
     * on `visibilitychange` and `focus`, so every trip the phone made in and
     * out of a pocket fired these RPCs across congested LTE — and any one of
     * them failing tore the session down. `logout()` revokes the
     * `user_sessions` row and calls `signOut()`, so a dropped request cost a
     * real login, not just a re-render.
     */
    it("keeps the session when start_session cannot reach the server", async () => {
      const logout = vi.fn(async () => undefined)

      const result = await bootstrapAuthSession(
        bootstrapDeps({
          openCurrentSession: async () => ({
            data: null,
            error: "TypeError: Failed to fetch",
          }),
          logout,
        }),
      )

      expect(logout).not.toHaveBeenCalled()
      expect(result).toEqual({ profile: null, shouldLogout: false })
    })

    it("does not ask whether a session is valid when it could not be opened", async () => {
      // A row that was never written answers `false` perfectly truthfully, and
      // that `false` is indistinguishable from a revoked session. The question
      // is only meaningful once the write succeeds, so it must not be asked.
      const isServerSessionValid = vi.fn(async () => ({
        data: false,
        error: null,
      }))
      const logout = vi.fn(async () => undefined)

      await bootstrapAuthSession(
        bootstrapDeps({
          openCurrentSession: async () => ({ data: null, error: "network" }),
          isServerSessionValid,
          logout,
        }),
      )

      expect(isServerSessionValid).not.toHaveBeenCalled()
      expect(logout).not.toHaveBeenCalled()
    })

    it("keeps the session when the validity check itself errors", async () => {
      // `isServerSessionValid` reports failure as `{ data: null, error }`.
      // Reading only `data` made a request that never landed look exactly like
      // a session the server had rejected.
      const logout = vi.fn(async () => undefined)

      const result = await bootstrapAuthSession(
        bootstrapDeps({
          isServerSessionValid: async () => ({ data: null, error: "network" }),
          logout,
        }),
      )

      expect(logout).not.toHaveBeenCalled()
      expect(result).toEqual({ profile: null, shouldLogout: false })
    })

    it("signs out when the server answers that the session is invalid", async () => {
      // Revoked from another device, or aged past `expires_at`. This is the one
      // case where ending the session is the correct response, and widening the
      // tolerance above must not swallow it.
      const logout = vi.fn(async () => undefined)

      const result = await bootstrapAuthSession(
        bootstrapDeps({
          isServerSessionValid: async () => ({ data: false, error: null }),
          logout,
        }),
      )

      expect(logout).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ profile: null, shouldLogout: true })
    })
  })

  describe("the local session stamp is a cache, not the record", () => {
    /**
     * `isSessionExpired` reports a missing `auth:session-started-at` as expired,
     * so anything that drops localStorage — iOS evicting it under pressure,
     * clearing site data — used to end a session whose cookies were still good.
     * Both deps below are wired to one piece of state to mirror how
     * `session-state.ts` actually pairs them.
     */
    it("adopts a missing stamp instead of reading it as expired", async () => {
      const logout = vi.fn(async () => undefined)
      let stampedAtMs: number | null = null

      const result = await bootstrapAuthSession(
        bootstrapDeps({
          markSessionStartIfMissing: () => {
            stampedAtMs ??= Date.now()
          },
          isSessionExpired: () => stampedAtMs === null,
          logout,
        }),
      )

      expect(logout).not.toHaveBeenCalled()
      expect(result).toEqual({ profile: userProfile, shouldLogout: false })
    })

    it("still signs out a stamp that is genuinely older than the max age", async () => {
      // The stamp exists, so `markSessionStartIfMissing` leaves it alone and the
      // expiry check stands. Adopting a missing stamp must not blunt a real one.
      const logout = vi.fn(async () => undefined)
      let stampedAtMs: number | null = Date.now() - (SEVEN_DAYS_MS + 1000)

      const result = await bootstrapAuthSession(
        bootstrapDeps({
          markSessionStartIfMissing: () => {
            stampedAtMs ??= Date.now()
          },
          isSessionExpired: () =>
            stampedAtMs !== null && Date.now() - stampedAtMs > SEVEN_DAYS_MS,
          logout,
        }),
      )

      expect(logout).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ profile: null, shouldLogout: true })
    })
  })
})
