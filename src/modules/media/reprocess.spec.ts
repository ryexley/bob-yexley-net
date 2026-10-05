/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest"

type Row = {
  id: string
  storage_key: string
  mime_type: string
  width: number | null
  height: number | null
}

const { mockGenerateVariants, state } = vi.hoisted(() => ({
  mockGenerateVariants: vi.fn(),
  state: {
    user: { id: "user-1" } as { id: string } | null,
    role: "superuser" as string | null,
    rows: [] as Row[],
    updates: [] as Array<{ id: unknown; values: Record<string, unknown> }>,
    notIn: [] as string[],
    updateError: null as { message: string } | null,
  },
}))

/** Minimal chainable stand-in for the Supabase query builder. */
function makeFrom() {
  return () => {
    let mode: "select" | "update" = "select"
    let values: Record<string, unknown> = {}
    let limit = Infinity
    const filters: Array<(row: Row) => boolean> = []
    const builder: Record<string, unknown> = {
      select: () => builder,
      update: (next: Record<string, unknown>) => {
        mode = "update"
        values = next
        return builder
      },
      eq: (column: string, value: unknown) => {
        if (mode === "update" && column === "id") {
          state.updates.push({ id: value, values })
        }
        return builder
      },
      neq: () => builder,
      not: (_column: string, _op: string, list: string) => {
        const ids = list.replace(/[()]/g, "").split(",")
        state.notIn = ids
        filters.push(row => !ids.includes(row.id))
        return builder
      },
      order: () => builder,
      limit: (n: number) => {
        limit = n
        return builder
      },
      then: (resolve: (value: unknown) => void) => {
        if (mode === "update") {
          return resolve({ error: state.updateError })
        }
        const updated = new Set(
          state.updates.filter(() => !state.updateError).map(u => u.id),
        )
        const live = state.rows.filter(row => !updated.has(row.id))
        const filtered = live.filter(row => filters.every(f => f(row)))
        return resolve({
          data: filtered.slice(0, limit),
          error: null,
          count: live.length,
        })
      },
    }
    return builder
  }
}

vi.mock("@/lib/vendor/supabase/server", () => ({
  getServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    from: makeFrom(),
  }),
}))

vi.mock("@/lib/vendor/supabase/user-profile", () => ({
  selectUserProfileRecord: async () => ({
    data: state.role ? { role: state.role } : null,
    error: null,
  }),
}))

vi.mock("./server", () => ({ generateVariants: mockGenerateVariants }))

import { reprocessFailedMedia } from "./reprocess"

const row = (id: string, overrides: Partial<Row> = {}): Row => ({
  id,
  storage_key: `media/user-1/blip-1/${id}`,
  mime_type: "image/jpeg",
  width: null,
  height: null,
  ...overrides,
})

const missing = () => Object.assign(new Error("nope"), { name: "NoSuchKey" })

describe("reprocessFailedMedia", () => {
  beforeEach(() => {
    state.user = { id: "user-1" }
    state.role = "superuser"
    state.rows = []
    state.updates = []
    state.notIn = []
    state.updateError = null
    mockGenerateVariants.mockReset()
    mockGenerateVariants.mockResolvedValue({
      storageKey: "x",
      original: { width: 3024, height: 4032, format: "jpeg" },
      variants: {},
    })
  })

  it("rejects an anonymous caller", async () => {
    state.user = null
    const result = await reprocessFailedMedia({})
    expect(result.status).toBe(401)
    expect(mockGenerateVariants).not.toHaveBeenCalled()
  })

  it("rejects a signed-in non-admin", async () => {
    state.role = "visitor"
    state.rows = [row("a0000000-0000-4000-8000-000000000001")]
    const result = await reprocessFailedMedia({})
    expect(result.status).toBe(403)
    expect(mockGenerateVariants).not.toHaveBeenCalled()
  })

  it("rejects a malformed payload", async () => {
    const result = await reprocessFailedMedia({ limit: 999 })
    expect(result.status).toBe(400)
  })

  it("regenerates variants and marks rows complete, keeping known dimensions", async () => {
    state.rows = [
      row("a0000000-0000-4000-8000-000000000001"),
      row("a0000000-0000-4000-8000-000000000002", {
        mime_type: "image/png",
        width: 100,
        height: 50,
      }),
    ]
    const result = await reprocessFailedMedia({})

    expect(result.status).toBe(200)
    expect(result.data?.reprocessed).toHaveLength(2)
    expect(result.data?.remaining).toBe(0)
    expect(mockGenerateVariants).toHaveBeenCalledWith(
      "media/user-1/blip-1/a0000000-0000-4000-8000-000000000001-original.jpg",
      "media/user-1/blip-1/a0000000-0000-4000-8000-000000000001",
    )
    expect(mockGenerateVariants).toHaveBeenCalledWith(
      "media/user-1/blip-1/a0000000-0000-4000-8000-000000000002-original.png",
      "media/user-1/blip-1/a0000000-0000-4000-8000-000000000002",
    )
    expect(state.updates).toEqual([
      {
        id: "a0000000-0000-4000-8000-000000000001",
        values: { processing_status: "complete", width: 3024, height: 4032 },
      },
      {
        id: "a0000000-0000-4000-8000-000000000002",
        values: { processing_status: "complete", width: 100, height: 50 },
      },
    ])
  })

  it("falls back to the historical .jpeg original", async () => {
    state.rows = [row("a0000000-0000-4000-8000-000000000001")]
    mockGenerateVariants.mockRejectedValueOnce(missing())
    const result = await reprocessFailedMedia({})
    expect(result.data?.reprocessed).toHaveLength(1)
    expect(mockGenerateVariants).toHaveBeenLastCalledWith(
      "media/user-1/blip-1/a0000000-0000-4000-8000-000000000001-original.jpeg",
      "media/user-1/blip-1/a0000000-0000-4000-8000-000000000001",
    )
  })

  it("reports a row whose original is gone without updating it", async () => {
    state.rows = [row("a0000000-0000-4000-8000-000000000001")]
    mockGenerateVariants.mockRejectedValue(missing())
    const result = await reprocessFailedMedia({})
    expect(result.data?.failed).toEqual([
      {
        id: "a0000000-0000-4000-8000-000000000001",
        error: "Original object not found",
      },
    ])
    expect(result.data?.remaining).toBe(1)
    expect(state.updates).toEqual([])
  })

  it("refuses keys outside the caller's namespace", async () => {
    state.rows = [
      row("a0000000-0000-4000-8000-000000000001", {
        storage_key: "media/someone-else/blip/x",
      }),
    ]
    const result = await reprocessFailedMedia({})
    expect(result.data?.failed[0].error).toMatch(/namespace/)
    expect(mockGenerateVariants).not.toHaveBeenCalled()
  })

  it("honors limit and excludeIds", async () => {
    state.rows = [
      row("a0000000-0000-4000-8000-000000000001"),
      row("a0000000-0000-4000-8000-000000000002"),
      row("a0000000-0000-4000-8000-000000000003"),
    ]
    const result = await reprocessFailedMedia({
      limit: 1,
      excludeIds: ["a0000000-0000-4000-8000-000000000001"],
    })
    expect(state.notIn).toEqual(["a0000000-0000-4000-8000-000000000001"])
    expect(result.data?.reprocessed).toEqual([
      "a0000000-0000-4000-8000-000000000002",
    ])
    expect(result.data?.remaining).toBe(2)
  })
})
