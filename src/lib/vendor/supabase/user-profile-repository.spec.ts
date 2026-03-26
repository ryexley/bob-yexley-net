import { beforeEach, describe, expect, it, vi } from "vitest"
import { AUTH_RPC } from "@/lib/vendor/supabase/auth-rpc-names"
import { createUserProfileRepository } from "@/lib/vendor/supabase/user-profile-repository"

const { selectUserProfileRecord, buildUserProfile } = vi.hoisted(() => ({
  selectUserProfileRecord: vi.fn(),
  buildUserProfile: vi.fn(),
}))

vi.mock("@/lib/vendor/supabase/user-profile", () => ({
  selectUserProfileRecord,
  buildUserProfile,
}))

describe("user-profile-repository", () => {
  beforeEach(() => {
    selectUserProfileRecord.mockReset()
    buildUserProfile.mockReset()
  })

  it("dedupes concurrent profile loads for the same user", async () => {
    selectUserProfileRecord.mockResolvedValue({
      data: { role: "visitor", visitorId: "visitor-1" },
      error: null,
    })
    buildUserProfile.mockReturnValue({
      user: { id: "user-1", email: "user@example.com" },
      role: "visitor",
      visitor: { id: "visitor-1", displayName: "Bob", status: "pending" },
    })

    const repository = createUserProfileRepository({
      getClient: () => ({}) as never,
      getSessionUser: async () => ({
        data: { id: "user-1", email: "user@example.com" } as never,
        error: null,
      }),
    })

    const [first, second] = await Promise.all([
      repository.getUserProfile(),
      repository.getUserProfile(),
    ])

    expect(selectUserProfileRecord).toHaveBeenCalledTimes(1)
    expect(first.data).toEqual(second.data)
  })

  it("serves subsequent requests from the in-memory cache", async () => {
    selectUserProfileRecord.mockResolvedValue({
      data: { role: "visitor", visitorId: "visitor-1" },
      error: null,
    })
    buildUserProfile.mockReturnValue({
      user: { id: "user-1", email: "user@example.com" },
      role: "visitor",
      visitor: { id: "visitor-1", displayName: "Bob", status: "pending" },
    })

    const repository = createUserProfileRepository({
      getClient: () => ({}) as never,
      getSessionUser: async () => ({
        data: { id: "user-1", email: "user@example.com" } as never,
        error: null,
      }),
    })

    await repository.getUserProfile()
    await repository.getUserProfile()

    expect(selectUserProfileRecord).toHaveBeenCalledTimes(1)
    expect(repository.peekUserProfile("user-1")?.user.id).toBe("user-1")
  })

  it("updates the current visitor display name and refreshes the cached profile", async () => {
    const rpc = vi.fn(async () => ({ error: null }))

    selectUserProfileRecord
      .mockResolvedValueOnce({
        data: { role: "visitor", visitorId: "visitor-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { role: "visitor", visitorId: "visitor-1" },
        error: null,
      })

    buildUserProfile
      .mockReturnValueOnce({
        user: { id: "user-1", email: "user@example.com" },
        role: "visitor",
        visitor: { id: "visitor-1", displayName: "Bob", status: "pending" },
      })
      .mockReturnValueOnce({
        user: { id: "user-1", email: "user@example.com" },
        role: "visitor",
        visitor: { id: "visitor-1", displayName: "Bobby", status: "pending" },
      })

    const repository = createUserProfileRepository({
      getClient: () => ({ rpc }) as never,
      getSessionUser: async () => ({
        data: { id: "user-1", email: "user@example.com" } as never,
        error: null,
      }),
    })

    await repository.getUserProfile()
    const result = await repository.updateCurrentVisitorDisplayName("  Bobby  ")

    expect(rpc).toHaveBeenCalledWith(AUTH_RPC.updateProfile, {
      next_display_name: "Bobby",
    })
    expect(result.data?.visitor.displayName).toBe("Bobby")
    expect(repository.peekUserProfile("user-1")?.visitor.displayName).toBe("Bobby")
  })

  it("rejects blank visitor display name updates before calling rpc", async () => {
    const rpc = vi.fn(async () => ({ error: null }))
    const repository = createUserProfileRepository({
      getClient: () => ({ rpc }) as never,
      getSessionUser: async () => ({
        data: { id: "user-1", email: "user@example.com" } as never,
        error: null,
      }),
    })

    await expect(
      repository.updateCurrentVisitorDisplayName("   "),
    ).resolves.toEqual({
      data: null,
      error: "Display name is required",
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
