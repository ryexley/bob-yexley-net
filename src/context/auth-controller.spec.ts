import { describe, expect, it, vi } from "vitest"
import {
  bootstrapAuthSession,
  buildFallbackProfile,
  loadAuthProfile,
  resolveSignedInAuth,
} from "@/context/auth-controller"
import type { UserProfile } from "@/lib/vendor/supabase/browser"

const userProfile: UserProfile = {
  user: { id: "user-1", email: "user@example.com" },
  role: "visitor",
  roleCreatedAt: null,
  roleUpdatedAt: null,
  visitor: {
    id: "visitor-1",
    displayName: "Bob",
    status: "pending",
    failedLoginAttempts: 0,
    notes: null,
    createdAt: null,
  },
}

describe("auth-controller", () => {
  it("builds a visitor fallback profile", () => {
    expect(
      buildFallbackProfile({
        id: "user-1",
        email: "user@example.com",
      }),
    ).toMatchObject({
      user: { id: "user-1", email: "user@example.com" },
      role: "visitor",
      visitor: { id: null, status: null },
    })
  })

  it("falls back quietly when profile lookup fails", async () => {
    const profile = await loadAuthProfile(
      { id: "user-1", email: "user@example.com" },
      async () => ({ data: null, error: "boom" }),
    )

    expect(profile).toMatchObject({
      user: { id: "user-1" },
      role: "visitor",
    })
  })

  it("bootstraps an authenticated profile when client and server sessions are valid", async () => {
    const loadUserProfile = vi.fn(async () => userProfile)

    const result = await bootstrapAuthSession({
      getUser: async () => ({
        data: { id: "user-1", email: "user@example.com" },
        error: null,
      }),
      isSessionExpired: () => false,
      isServerSessionValid: async () => ({ data: true, error: null }),
      logout: async () => undefined,
      loadUserProfile,
    })

    expect(loadUserProfile).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: userProfile, shouldLogout: false })
  })

  it("logs out on bootstrap when the local session is expired", async () => {
    const logout = vi.fn(async () => undefined)

    const result = await bootstrapAuthSession({
      getUser: async () => ({
        data: { id: "user-1", email: "user@example.com" },
        error: null,
      }),
      isSessionExpired: () => true,
      isServerSessionValid: async () => ({ data: true, error: null }),
      logout,
      loadUserProfile: async () => userProfile,
    })

    expect(logout).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: null, shouldLogout: true })
  })

  it("reuses a cached profile on sign-in transitions", async () => {
    const result = await resolveSignedInAuth({
      sessionUser: { id: "user-1", email: "user@example.com" },
      currentUserId: null,
      currentRole: null,
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

  it("logs out if starting the server session fails during sign-in", async () => {
    const logout = vi.fn(async () => undefined)

    const result = await resolveSignedInAuth({
      sessionUser: { id: "user-1", email: "user@example.com" },
      currentUserId: null,
      currentRole: null,
      cachedProfile: null,
      openCurrentSession: async () => ({ data: null, error: "nope" }),
      markSessionStartIfMissing: () => undefined,
      logout,
      loadUserProfile: async () => userProfile,
    })

    expect(logout).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: null, shouldLogout: true })
  })
})
