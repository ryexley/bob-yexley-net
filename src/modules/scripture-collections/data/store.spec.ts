import { createRoot } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { scriptureCollectionStore } from "@/modules/scripture-collections/data/store"

const {
  collectionRows,
  collectionLoadError,
  referenceRows,
  referenceLoadError,
  insertedCollection,
  insertError,
  updatedCollection,
  updateError,
  existingCollection,
  existingCollectionError,
  referencesUpdateError,
} = vi.hoisted(() => ({
  collectionRows: {
    value: [
      {
        id: 1000,
        name: "Comfort",
        description: "Passages for hard days",
        slug: "comfort",
        created_at: "2026-05-23T12:00:00.000Z",
        updated_at: "2026-05-23T12:00:00.000Z",
      },
    ],
  },
  collectionLoadError: { value: null as { message: string } | null },
  referenceRows: {
    value: [{ collection_id: 1000 }, { collection_id: 1000 }],
  },
  referenceLoadError: { value: null as { message: string } | null },
  insertedCollection: {
    value: {
      id: 1001,
      name: "Hope",
      description: null,
      slug: "hope",
      created_at: "2026-05-23T13:00:00.000Z",
      updated_at: "2026-05-23T13:00:00.000Z",
    },
  },
  insertError: { value: null as { message: string; code?: string } | null },
  updatedCollection: {
    value: {
      id: 1000,
      name: "Comfort and Peace",
      description: "Updated description",
      slug: "comfort-and-peace",
      created_at: "2026-05-23T12:00:00.000Z",
      updated_at: "2026-05-23T14:00:00.000Z",
    },
  },
  updateError: { value: null as { message: string; code?: string } | null },
  existingCollection: { value: { id: 1000 } as { id: number } | null },
  existingCollectionError: { value: null as { message: string } | null },
  referencesUpdateError: { value: null as { message: string } | null },
}))

const from = vi.fn()

const createQueryBuilder = (table: string) => {
  const state = {
    table,
    filters: [] as Array<(row: Record<string, unknown>) => boolean>,
    operation: "select" as "select" | "insert" | "update" | "delete",
    payload: null as Record<string, unknown> | null,
    maybeSingle: false,
    single: false,
  }

  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.operation = "insert"
      state.payload = payload
      return builder
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      state.operation = "update"
      state.payload = payload
      return builder
    }),
    delete: vi.fn(() => {
      state.operation = "delete"
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state.filters.push(row => row[column] === value)
      return builder
    }),
    is: vi.fn((column: string, value: null) => {
      state.filters.push(row => row[column] === value)
      return builder
    }),
    not: vi.fn((column: string, operator: string, value: unknown) => {
      if (operator === "is" && value === null) {
        state.filters.push(row => row[column] != null)
      }
      return builder
    }),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      state.maybeSingle = true
      return resolveResult(state)
    }),
    single: vi.fn(async () => {
      state.single = true
      return resolveResult(state)
    }),
  }

  async function resolveResult(currentState: typeof state) {
    if (currentState.table === "bible_passage_collections") {
      if (currentState.operation === "select") {
        if (collectionLoadError.value) {
          return { data: null, error: collectionLoadError.value }
        }

        if (currentState.maybeSingle) {
          return { data: existingCollection.value, error: existingCollectionError.value }
        }

        return { data: collectionRows.value, error: null }
      }

      if (currentState.operation === "insert") {
        return { data: insertedCollection.value, error: insertError.value }
      }

      if (currentState.operation === "update") {
        return { data: updatedCollection.value, error: updateError.value }
      }
    }

    if (currentState.table === "bible_passage_reference_collections") {
      if (currentState.operation === "select") {
        return { data: referenceRows.value, error: referenceLoadError.value }
      }

      if (currentState.operation === "update") {
        return { data: null, error: referencesUpdateError.value }
      }
    }

    return { data: null, error: null }
  }

  ;(builder as any).then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => resolveResult(state).then(onFulfilled, onRejected)

  return builder
}

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

describe("scriptureCollectionStore", () => {
  beforeEach(() => {
    collectionLoadError.value = null
    referenceLoadError.value = null
    insertError.value = null
    updateError.value = null
    existingCollection.value = { id: 1000 }
    existingCollectionError.value = null
    referencesUpdateError.value = null
    from.mockImplementation((table: string) => createQueryBuilder(table))
  })

  it("loads collections with reference counts", async () => {
    await runInRoot(async () => {
      const store = scriptureCollectionStore({ from } as any, { subscribe: false })
      const result = await store.loadAll(true)

      expect(result.error).toBeNull()
      expect(store.adminRecords()).toEqual([
        {
          id: 1000,
          name: "Comfort",
          description: "Passages for hard days",
          slug: "comfort",
          referenceCount: 2,
          createdAt: "2026-05-23T12:00:00.000Z",
          updatedAt: "2026-05-23T12:00:00.000Z",
        },
      ])
    })
  })

  it("creates a collection from valid payload", async () => {
    await runInRoot(async () => {
      const store = scriptureCollectionStore({ from } as any, { subscribe: false })

      await expect(
        store.createCollection({
          name: "Hope",
          description: "",
          slug: "hope",
        }),
      ).resolves.toEqual({
        success: true,
        data: {
          id: 1001,
          name: "Hope",
          description: null,
          slug: "hope",
          referenceCount: 0,
          createdAt: "2026-05-23T13:00:00.000Z",
          updatedAt: "2026-05-23T13:00:00.000Z",
        },
        error: null,
      })
    })
  })

  it("updates an existing collection", async () => {
    await runInRoot(async () => {
      const store = scriptureCollectionStore({ from } as any, { subscribe: false })

      await expect(
        store.updateCollection(1000, {
          name: "Comfort and Peace",
          description: "Updated description",
          slug: "comfort-and-peace",
        }),
      ).resolves.toEqual({
        success: true,
        data: {
          id: 1000,
          name: "Comfort and Peace",
          description: "Updated description",
          slug: "comfort-and-peace",
          referenceCount: 2,
          createdAt: "2026-05-23T12:00:00.000Z",
          updatedAt: "2026-05-23T14:00:00.000Z",
        },
        error: null,
      })
    })
  })

  it("soft deletes a collection and its references", async () => {
    await runInRoot(async () => {
      const store = scriptureCollectionStore({ from } as any, { subscribe: false })
      store.mergeIntoCache([
        {
          id: "1000",
          name: "Comfort",
          description: "Passages for hard days",
          slug: "comfort",
          created_at: "2026-05-23T12:00:00.000Z",
          updated_at: "2026-05-23T12:00:00.000Z",
          reference_count: 2,
        },
      ])

      await expect(store.deleteCollection(1000)).resolves.toEqual({
        success: true,
        error: null,
      })

      expect(store.adminRecords()).toEqual([])
    })
  })
})
