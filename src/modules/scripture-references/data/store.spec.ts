import { createRoot } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { scriptureReferenceStore } from "@/modules/scripture-references/data/store"

const {
  referenceRows,
  referenceLoadError,
  insertedReference,
  insertError,
  updatedReference,
  existingReference,
  existingReferenceError,
  junctionRows,
} = vi.hoisted(() => ({
  referenceRows: {
    value: [
      {
        id: 700,
        book: "John",
        chapter: 3,
        start_verse: 16,
        end_verse: null,
        slug: "john-3-16",
        created_at: "2026-05-23T12:00:00.000Z",
        updated_at: "2026-05-23T12:00:00.000Z",
        bible_passage_reference_collections: [
          {
            collection_id: 1000,
            bible_passage_collections: {
              id: 1000,
              name: "Comfort",
              slug: "comfort",
              deleted_at: null,
            },
          },
        ],
      },
    ],
  },
  referenceLoadError: { value: null as { message: string } | null },
  insertedReference: {
    value: {
      id: 701,
      book: "Romans",
      chapter: 8,
      start_verse: 28,
      end_verse: 30,
      slug: "romans-8-28-30",
      created_at: "2026-05-23T13:00:00.000Z",
      updated_at: "2026-05-23T13:00:00.000Z",
    },
  },
  updatedReference: {
    value: {
      id: 700,
      book: "Romans",
      chapter: 3,
      start_verse: 23,
      end_verse: null,
      slug: "romans-3-23",
      created_at: "2026-05-23T12:00:00.000Z",
      updated_at: "2026-05-23T14:00:00.000Z",
    },
  },
  insertError: { value: null as { message: string; code?: string } | null },
  existingReference: { value: { id: 700 } as { id: number } | null },
  existingReferenceError: { value: null as { message: string } | null },
  junctionRows: {
    value: [] as Array<{ collection_id: number }>,
  },
}))

const from = vi.fn()

vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({
    ok: true,
    json: async () => ({
      reference: "Romans 8:28-30",
      passage: "And we know that for those who love God...",
    }),
  })),
)

const upsertCollectionsByName = vi.fn(async (names: string[]) => ({
  data: names.map((name, index) => ({ id: 1000 + index, name })),
  error: null,
}))

const createQueryBuilder = (table: string) => {
  const state = {
    table,
    operation: "select" as "select" | "insert" | "update" | "delete",
    maybeSingle: false,
    single: false,
    filters: [] as Array<{ column: string; value: unknown }>,
  }

  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => {
      state.operation = "insert"
      return builder
    }),
    update: vi.fn(() => {
      state.operation = "update"
      return builder
    }),
    delete: vi.fn(() => {
      state.operation = "delete"
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state.filters.push({ column, value })
      return builder
    }),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
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
    if (currentState.table === "bible_passage_references") {
      if (currentState.operation === "select") {
        if (referenceLoadError.value) {
          return { data: null, error: referenceLoadError.value }
        }

        if (currentState.maybeSingle || currentState.single) {
          const idFilter = currentState.filters.find(filter => filter.column === "id")
          if (idFilter?.value === 701) {
            return {
              data: {
                ...insertedReference.value,
                bible_passage_reference_collections: [
                  {
                    collection_id: 1000,
                    bible_passage_collections: {
                      id: 1000,
                      name: "Comfort",
                      slug: "comfort",
                      deleted_at: null,
                    },
                  },
                ],
              },
              error: null,
            }
          }

          if (idFilter?.value === 700) {
            return {
              data: {
                ...updatedReference.value,
                bible_passage_reference_collections: [
                  {
                    collection_id: 1000,
                    bible_passage_collections: {
                      id: 1000,
                      name: "Comfort",
                      slug: "comfort",
                      deleted_at: null,
                    },
                  },
                ],
              },
              error: null,
            }
          }

          return { data: existingReference.value, error: existingReferenceError.value }
        }

        return { data: referenceRows.value, error: null }
      }

      if (currentState.operation === "insert") {
        return { data: insertedReference.value, error: insertError.value }
      }

      if (currentState.operation === "update") {
        return { data: currentState.single ? updatedReference.value : null, error: null }
      }
    }

    if (currentState.table === "bible_passage_reference_collections") {
      if (currentState.operation === "select") {
        return { data: junctionRows.value, error: null }
      }

      if (currentState.operation === "insert" || currentState.operation === "delete") {
        return { data: null, error: null }
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

describe("scriptureReferenceStore", () => {
  beforeEach(() => {
    referenceLoadError.value = null
    insertError.value = null
    existingReference.value = { id: 700 }
    existingReferenceError.value = null
    junctionRows.value = []
    from.mockImplementation((table: string) => createQueryBuilder(table))
    upsertCollectionsByName.mockImplementation(async (names: string[]) => ({
      data: names.map((name, index) => ({ id: 1000 + index, name })),
      error: null,
    }))
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        reference: "Romans 8:28-30",
        passage: "And we know that for those who love God...",
      }),
    } as Response)
  })

  it("loads references with collection names", async () => {
    await runInRoot(async () => {
      const store = scriptureReferenceStore({ from } as any, { subscribe: false })
      const result = await store.loadAll(true)

      expect(result.error).toBeNull()
      expect(store.adminRecords()).toEqual([
        {
          id: 700,
          book: "John",
          chapter: 3,
          startVerse: 16,
          endVerse: null,
          normalized: "John 3:16",
          slug: "john-3-16",
          collections: [{ id: 1000, name: "Comfort", slug: "comfort" }],
          createdAt: "2026-05-23T12:00:00.000Z",
          updatedAt: "2026-05-23T12:00:00.000Z",
        },
      ])
    })
  })

  it("creates a reference with collections", async () => {
    await runInRoot(async () => {
      const store = scriptureReferenceStore({ from } as any, { subscribe: false })

      await expect(
        store.createReference(
          {
            book: "Romans",
            chapter: 8,
            startVerse: 28,
            endVerse: 30,
            collectionNames: ["Comfort"],
          },
          upsertCollectionsByName,
        ),
      ).resolves.toEqual({
        success: true,
        data: {
          id: 701,
          book: "Romans",
          chapter: 8,
          startVerse: 28,
          endVerse: 30,
          normalized: "Romans 8:28-30",
          slug: "romans-8-28-30",
          collections: [{ id: 1000, name: "Comfort", slug: "comfort" }],
          createdAt: "2026-05-23T13:00:00.000Z",
          updatedAt: "2026-05-23T13:00:00.000Z",
        },
        error: null,
      })
    })
  })

  it("updates a reference with collections", async () => {
    await runInRoot(async () => {
      const store = scriptureReferenceStore({ from } as any, { subscribe: false })

      await expect(
        store.updateReference(
          700,
          {
            book: "Romans",
            chapter: 3,
            startVerse: 23,
            endVerse: null,
            collectionNames: ["Comfort"],
          },
          upsertCollectionsByName,
        ),
      ).resolves.toEqual({
        success: true,
        data: {
          id: 700,
          book: "Romans",
          chapter: 3,
          startVerse: 23,
          endVerse: null,
          normalized: "Romans 3:23",
          slug: "romans-3-23",
          collections: [{ id: 1000, name: "Comfort", slug: "comfort" }],
          createdAt: "2026-05-23T12:00:00.000Z",
          updatedAt: "2026-05-23T14:00:00.000Z",
        },
        error: null,
      })
    })
  })

  it("soft deletes a reference", async () => {
    await runInRoot(async () => {
      const store = scriptureReferenceStore({ from } as any, { subscribe: false })
      store.mergeIntoCache([
        {
          id: "700",
          book: "John",
          chapter: 3,
          start_verse: 16,
          end_verse: null,
          slug: "john-3-16",
          created_at: "2026-05-23T12:00:00.000Z",
          updated_at: "2026-05-23T12:00:00.000Z",
          collections: [{ id: 1000, name: "Comfort", slug: "comfort" }],
        },
      ])

      await expect(store.deleteReference(700)).resolves.toEqual({
        success: true,
        error: null,
      })

      expect(store.adminRecords()).toEqual([])
    })
  })
})
