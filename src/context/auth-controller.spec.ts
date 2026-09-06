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

    const result = await bootstrapAuthSession({
      getUser: async () => ({
        data: { id: "user-1", email: "user@example.com" },
        error: null,
      }),
      isSessionExpired: () => false,
      openCurrentSession,
      isServerSessionValid: async () => ({ data: true, error: null }),
      logout: async () => undefined,
      loadUserProfile,
    })

    expect(openCurrentSession).toHaveBeenCalledTimes(1)
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
      openCurrentSession: async () => ({ data: null, error: null }),
      isServerSessionValid: async () => ({ data: true, error: null }),
      logout,
      loadUserProfile: async () => userProfile,
    })

    expect(logout).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ profile: null, shouldLogout: true })
  })

  it("logs out on bootstrap when the healed profile is hollow", async () => {
    const logout = vi.fn(async () => undefined)

    const result = await bootstrapAuthSession({
      getUser: async () => ({
        data: { id: "user-1", email: "user@example.com" },
        error: null,
      }),
      isSessionExpired: () => false,
      openCurrentSession: async () => ({ data: null, error: null }),
      isServerSessionValid: async () => ({ data: true, error: null }),
      logout,
      loadUserProfile: async () => hollowProfile,
    })

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

  it("logs out if starting the server session fails during sign-in", async () => {
    const logout = vi.fn(async () => undefined)

    const result = await resolveSignedInAuth({
      sessionUser: { id: "user-1", email: "user@example.com" },
      currentUserId: null,
      currentRole: null,
      currentProfileId: null,
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
