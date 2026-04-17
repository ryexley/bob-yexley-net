import { describe, expect, it, vi } from "vitest"
import { REACTION_ERROR } from "@/modules/blips/data/errors"
import { reactionStore } from "@/modules/blips/data/reactions-store"

const createClient = () => {
  const insert = vi.fn(async () => ({ error: null }))
  const deleteChain = {
    eq: vi.fn().mockReturnThis(),
  }
  const remove = vi.fn(() => deleteChain)
  const from = vi.fn(() => ({
    insert,
    delete: remove,
  }))

  return {
    client: { from } as never,
    from,
    insert,
    remove,
    deleteChain,
  }
}

describe("reactions-store", () => {
  it("rejects toggles without an authenticated profile id", async () => {
    const { client } = createClient()
    const store = reactionStore(client, { subscribe: false })

    await expect(
      store.toggleReaction("blip-1", "🔥", {
        profileId: null,
        status: "active",
        currentCount: 0,
        hasActiveReaction: false,
      }),
    ).resolves.toEqual({
      data: null,
      error: REACTION_ERROR.AUTH_REQUIRED,
    })
  })

  it("enforces the per-blip limit in application code", async () => {
    const { client } = createClient()
    const store = reactionStore(client, { subscribe: false })

    await expect(
      store.toggleReaction("blip-1", "🔥", {
        profileId: "profile-1",
        status: "active",
        currentCount: 3,
        hasActiveReaction: false,
      }),
    ).resolves.toEqual({
      data: null,
      error: REACTION_ERROR.LIMIT_REACHED,
    })
  })

  it("uses one direct insert for a new reaction", async () => {
    const { client, insert } = createClient()
    const store = reactionStore(client, { subscribe: false })

    await expect(
      store.toggleReaction("blip-1", "🔥", {
        profileId: "profile-1",
        status: "active",
        currentCount: 0,
        hasActiveReaction: false,
      }),
    ).resolves.toEqual({
      data: {
        active: true,
        myReactionCount: 1,
      },
      error: null,
    })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith({
      blip_id: "blip-1",
      user_profile_id: "profile-1",
      emoji: "🔥",
    })
  })

  it("uses one direct delete for removing an active reaction", async () => {
    const { client, remove, deleteChain } = createClient()
    const store = reactionStore(client, { subscribe: false })

    await expect(
      store.toggleReaction("blip-1", "🔥", {
        profileId: "profile-1",
        status: "active",
        currentCount: 2,
        hasActiveReaction: true,
      }),
    ).resolves.toEqual({
      data: {
        active: false,
        myReactionCount: 1,
      },
      error: null,
    })

    expect(remove).toHaveBeenCalledTimes(1)
    expect(deleteChain.eq).toHaveBeenNthCalledWith(1, "blip_id", "blip-1")
    expect(deleteChain.eq).toHaveBeenNthCalledWith(2, "user_profile_id", "profile-1")
    expect(deleteChain.eq).toHaveBeenNthCalledWith(3, "emoji", "🔥")
  })
})
