import { beforeEach, describe, expect, it, vi } from "vitest"
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
      data: { role: "visitor", profileId: "profile-1" },
      error: null,
    })
    buildUserProfile.mockReturnValue({
      user: { id: "user-1", email: "user@example.com" },
      role: "visitor",
      profile: { id: "profile-1", displayName: "Bob" },
      system: { status: "pending" },
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
      data: { role: "visitor", profileId: "profile-1" },
      error: null,
    })
    buildUserProfile.mockReturnValue({
      user: { id: "user-1", email: "user@example.com" },
      role: "visitor",
      profile: { id: "profile-1", displayName: "Bob" },
      system: { status: "pending" },
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

  it("updates the current user display name and refreshes the cached profile", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: "profile-1" }, error: null }))
    const select = vi.fn(() => ({ maybeSingle }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))

    selectUserProfileRecord
      .mockResolvedValueOnce({
        data: { role: "visitor", profileId: "profile-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { role: "visitor", profileId: "profile-1" },
        error: null,
      })

    buildUserProfile
      .mockReturnValueOnce({
        user: { id: "user-1", email: "user@example.com" },
        role: "visitor",
        profile: { id: "profile-1", displayName: "Bob" },
        system: { status: "pending" },
      })
      .mockReturnValueOnce({
        user: { id: "user-1", email: "user@example.com" },
        role: "visitor",
        profile: { id: "profile-1", displayName: "Bobby" },
        system: { status: "pending" },
      })

    const repository = createUserProfileRepository({
      getClient: () => ({ from: vi.fn(() => ({ update })) }) as never,
      getSessionUser: async () => ({
        data: { id: "user-1", email: "user@example.com" } as never,
        error: null,
      }),
    })

    await repository.getUserProfile()
    const result = await repository.updateCurrentUserDisplayName("  Bobby  ")

    expect(update).toHaveBeenCalledWith({
      display_name: "Bobby",
    })
    expect(eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(result.data?.profile.displayName).toBe("Bobby")
    expect(repository.peekUserProfile("user-1")?.profile.displayName).toBe("Bobby")
  })

  it("rejects blank user display name updates before calling the database", async () => {
    const from = vi.fn()
    const repository = createUserProfileRepository({
      getClient: () => ({ from }) as never,
      getSessionUser: async () => ({
        data: { id: "user-1", email: "user@example.com" } as never,
        error: null,
      }),
    })

    await expect(
      repository.updateCurrentUserDisplayName("   "),
    ).resolves.toEqual({
      data: null,
      error: "Display name is required",
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("updates the current user avatar version and refreshes the cached profile", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: "profile-1" }, error: null }))
    const select = vi.fn(() => ({ maybeSingle }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))

    selectUserProfileRecord
      .mockResolvedValueOnce({
        data: { role: "visitor", profileId: "profile-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { role: "visitor", profileId: "profile-1" },
        error: null,
      })

    buildUserProfile
      .mockReturnValueOnce({
        user: { id: "user-1", email: "user@example.com" },
        role: "visitor",
        profile: {
          id: "profile-1",
          displayName: "Bob",
          avatarVersion: 1,
        },
        system: {
          status: "pending",
        },
      })
      .mockReturnValueOnce({
        user: { id: "user-1", email: "user@example.com" },
        role: "visitor",
        profile: {
          id: "profile-1",
          displayName: "Bob",
          avatarVersion: 2,
        },
        system: {
          status: "pending",
        },
      })

    const repository = createUserProfileRepository({
      getClient: () => ({ from: vi.fn(() => ({ update })) }) as never,
      getSessionUser: async () => ({
        data: { id: "user-1", email: "user@example.com" } as never,
        error: null,
      }),
    })

    await repository.getUserProfile()
    const result = await repository.updateCurrentUserAvatarVersion(2)

    expect(update).toHaveBeenCalledWith({
      avatar_version: 2,
    })
    expect(eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(result.data?.profile.avatarVersion).toBe(2)
    expect(repository.peekUserProfile("user-1")?.profile.avatarVersion).toBe(2)
  })
})
