import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"
import { blipStore } from "@/modules/blips/data/store"

const makeBlip = (overrides: Partial<Blip> = {}): Blip => ({
  id: "blip-1",
  title: null,
  content: "Test blip",
  user_id: "user-1",
  parent_id: null,
  blip_type: BLIP_TYPES.ROOT,
  updates_count: 0,
  published: true,
  moderation_status: "approved",
  tags: [],
  reactions_count: 0,
  my_reaction_count: 0,
  reactions: [],
  created_at: "2026-03-28T12:00:00.000Z",
  updated_at: "2026-03-28T12:00:00.000Z",
  ...overrides,
})

const runInRoot = async (callback: () => Promise<void>) =>
  await new Promise<void>((resolve, reject) => {
    createRoot(dispose => {
      void callback()
        .then(() => {
          dispose()
          resolve()
        })
        .catch(error => {
          dispose()
          reject(error)
        })
    })
  })

describe("blipStore reaction cache sync", () => {
  it("keeps a freshly cached active visitor reaction visible after logout sync", async () => {
    await runInRoot(async () => {
      const store = blipStore({} as any, { subscribe: false })
      const blip = makeBlip()

      store.setInitialData([blip])

      store.updateCachedReactionState(blip.id, {
        reactions: [
          {
            emoji: "🔥",
            count: 1,
            reacted_by_current_user: true,
            display_names: ["Bob"],
          },
        ],
        reactions_count: 1,
        my_reaction_count: 1,
      })

      await Promise.resolve()

      await store.syncReactionViewer(
        [blip.id],
        {
          id: null,
          status: null,
          displayName: null,
        },
        {
          id: "visitor-1",
          status: "active",
          displayName: "Bob",
        },
      )

      expect(store.entities()).toHaveLength(1)
      expect(store.entities()[0]?.reactions).toEqual([
        {
          emoji: "🔥",
          count: 1,
          reacted_by_current_user: false,
          display_names: ["Bob"],
        },
      ])
      expect(store.entities()[0]?.reactions_count).toBe(1)
      expect(store.entities()[0]?.my_reaction_count).toBe(0)
    })
  })
})

describe("blipStore comment ordering", () => {
  it("sorts comments newest first within each parent", async () => {
    await runInRoot(async () => {
      const store = blipStore({} as any, { subscribe: false })
      const rootId = "root-1"

      store.setInitialData([
        makeBlip({ id: rootId }),
        makeBlip({
          id: "comment-oldest",
          parent_id: rootId,
          blip_type: BLIP_TYPES.COMMENT,
          created_at: "2026-03-28T12:00:00.000Z",
        }),
        makeBlip({
          id: "comment-newest",
          parent_id: rootId,
          blip_type: BLIP_TYPES.COMMENT,
          created_at: "2026-03-28T12:02:00.000Z",
        }),
        makeBlip({
          id: "comment-middle",
          parent_id: rootId,
          blip_type: BLIP_TYPES.COMMENT,
          created_at: "2026-03-28T12:01:00.000Z",
        }),
      ])

      await Promise.resolve()

      expect(store.commentsByParent(rootId).map(comment => comment.id)).toEqual([
        "comment-newest",
        "comment-middle",
        "comment-oldest",
      ])
    })
  })
})

describe("blipStore scoped comment replacement", () => {
  it("replaces cached comments for targeted parents without touching others", async () => {
    await runInRoot(async () => {
      const store = blipStore({} as any, { subscribe: false })
      const rootId = "root-1"
      const updateId = "update-1"
      const otherRootId = "root-2"

      store.setInitialData([
        makeBlip({ id: rootId }),
        makeBlip({
          id: updateId,
          parent_id: rootId,
          blip_type: BLIP_TYPES.UPDATE,
        }),
        makeBlip({ id: otherRootId }),
        makeBlip({
          id: "pending-root-comment",
          parent_id: rootId,
          blip_type: BLIP_TYPES.COMMENT,
          moderation_status: "pending",
          published: false,
        }),
        makeBlip({
          id: "pending-update-comment",
          parent_id: updateId,
          blip_type: BLIP_TYPES.COMMENT,
          moderation_status: "pending",
          published: false,
        }),
        makeBlip({
          id: "other-parent-comment",
          parent_id: otherRootId,
          blip_type: BLIP_TYPES.COMMENT,
        }),
      ])

      store.replaceCommentsForParents(
        [rootId, updateId],
        [
          makeBlip({
            id: "public-root-comment",
            parent_id: rootId,
            blip_type: BLIP_TYPES.COMMENT,
            moderation_status: "approved",
            published: true,
          }),
        ],
      )

      await Promise.resolve()

      expect(store.commentsByParent(rootId).map(comment => comment.id)).toEqual([
        "public-root-comment",
      ])
      expect(store.commentsByParent(updateId)).toEqual([])
      expect(store.commentsByParent(otherRootId).map(comment => comment.id)).toEqual([
        "other-parent-comment",
      ])
    })
  })
})
