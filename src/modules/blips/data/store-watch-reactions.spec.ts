import { createRoot } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"

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

describe("blipStore watchBlips", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("emits updates for watched blip rows", async () => {
    await runInRoot(async () => {
      const handlers: Array<{
        config: { event: string; table: string; filter?: string }
        callback: (payload: any) => void
      }> = []
      const channel = {
        on: (
          _type: string,
          config: { event: string; table: string; filter?: string },
          callback: (payload: any) => void,
        ) => {
          handlers.push({ config, callback })
          return channel
        },
        subscribe: () => channel,
      }
      const supabaseClient = {
        channel: () => channel,
        removeChannel: vi.fn(),
      } as any

      const store = blipStore(supabaseClient, { subscribe: false })
      store.setInitialData([makeBlip()])

      const onUpdate = vi.fn()
      const unsubscribe = store.watchBlips(["blip-1"], { onUpdate })

      const blipUpdateHandler = handlers.find(
        handler =>
          handler.config.event === "UPDATE" &&
          handler.config.table === "blips" &&
          handler.config.filter === "id=eq.blip-1",
      )

      expect(blipUpdateHandler).toBeTruthy()

      blipUpdateHandler?.callback({
        new: {
          ...makeBlip(),
          updated_at: "2026-03-28T12:01:00.000Z",
        },
      })

      await Promise.resolve()

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "blip-1",
          updated_at: "2026-03-28T12:01:00.000Z",
        }),
      )
      expect(store.entities()[0]).toEqual(
        expect.objectContaining({
          id: "blip-1",
          content: "Test blip",
        }),
      )

      unsubscribe()
    })
  })
})
