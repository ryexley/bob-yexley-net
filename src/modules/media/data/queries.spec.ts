import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  flattenBlipPageMedia,
  groupMediaByBlipId,
  indexMediaById,
  selectBlipMedia,
  selectUpdateBlipIdsByRoot,
  type BlipMediaRow,
} from "./queries"

const row = (over: Partial<BlipMediaRow> = {}): BlipMediaRow =>
  ({
    id: "row-1",
    blip_id: "blip-1",
    user_id: "user-1",
    media_type: "image",
    mime_type: "image/jpeg",
    storage_key: "media/user-1/blip-1/photo",
    processing_status: "complete",
    file_size: 1000,
    width: 800,
    height: 600,
    duration_s: null,
    display_order: 0,
    created_at: "2026-06-20T00:00:00.000Z",
    ...over,
  }) as BlipMediaRow

const createSupabaseMock = (rows: BlipMediaRow[], error: { message: string } | null = null) => {
  const calls: { in?: [string, unknown[]]; order?: [string, unknown] } = {}
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn((column: string, values: unknown[]) => {
      calls.in = [column, values]
      return builder
    }),
    order: vi.fn((column: string, opts: unknown) => {
      calls.order = [column, opts]
      return Promise.resolve({ data: error ? null : rows, error })
    }),
  }
  const from = vi.fn(() => builder)
  return { client: { from } as unknown as SupabaseClient, from, calls }
}

const createUpdateBlipsMock = (
  rows: Array<{
    id: string
    parent_id: string
    publish_at?: string | null
    created_at: string
  }>,
  error: { message: string } | null = null,
) => {
  const calls: { in?: [string, unknown[]]; eq?: [string, unknown][] } = {}
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn((column: string, values: unknown[]) => {
      calls.in = [column, values]
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      calls.eq = [...(calls.eq ?? []), [column, value]]
      return Promise.resolve({ data: error ? null : rows, error })
    }),
  }
  const from = vi.fn(() => builder)
  return { client: { from } as unknown as SupabaseClient, from, calls }
}

describe("selectBlipMedia", () => {
  it("returns [] without querying for an empty / falsy id set", async () => {
    const mock = createSupabaseMock([])
    expect(await selectBlipMedia(mock.client, [])).toEqual([])
    expect(await selectBlipMedia(mock.client, ["", null as never])).toEqual([])
    expect(mock.from).not.toHaveBeenCalled()
  })

  it("dedupes ids and queries blip_media ordered by display_order", async () => {
    const rows = [row({ id: "a", display_order: 0 }), row({ id: "b", display_order: 1 })]
    const mock = createSupabaseMock(rows)

    const result = await selectBlipMedia(mock.client, ["blip-1", "blip-1", "blip-2"])

    expect(result).toEqual(rows)
    expect(mock.from).toHaveBeenCalledWith("blip_media")
    expect(mock.calls.in).toEqual(["blip_id", ["blip-1", "blip-2"]])
    expect(mock.calls.order).toEqual(["display_order", { ascending: true }])
  })

  it("throws when the query errors", async () => {
    const mock = createSupabaseMock([], { message: "boom" })
    await expect(selectBlipMedia(mock.client, ["blip-1"])).rejects.toMatchObject({
      message: "boom",
    })
  })
})

describe("selectUpdateBlipIdsByRoot", () => {
  it("returns {} without querying for an empty root id set", async () => {
    const mock = createUpdateBlipsMock([])
    expect(await selectUpdateBlipIdsByRoot(mock.client, [])).toEqual({})
    expect(mock.from).not.toHaveBeenCalled()
  })

  it("groups update ids by root, newest publish first", async () => {
    const mock = createUpdateBlipsMock([
      {
        id: "update-old",
        parent_id: "root-1",
        publish_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "update-new",
        parent_id: "root-1",
        publish_at: "2026-02-01T00:00:00.000Z",
        created_at: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "update-other-root",
        parent_id: "root-2",
        publish_at: null,
        created_at: "2026-03-01T00:00:00.000Z",
      },
    ])

    const result = await selectUpdateBlipIdsByRoot(mock.client, [
      "root-1",
      "root-2",
      "root-1",
    ])

    expect(result).toEqual({
      "root-1": ["update-new", "update-old"],
      "root-2": ["update-other-root"],
    })
    expect(mock.from).toHaveBeenCalledWith("blips")
    expect(mock.calls.in).toEqual(["parent_id", ["root-1", "root-2"]])
    expect(mock.calls.eq).toContainEqual(["blip_type", "update"])
  })
})

describe("groupMediaByBlipId", () => {
  it("groups rows by blip_id preserving order, omitting empty blips", () => {
    const rows = [
      row({ id: "1", blip_id: "root", display_order: 0 }),
      row({ id: "2", blip_id: "update-1", display_order: 0 }),
      row({ id: "3", blip_id: "root", display_order: 1 }),
    ]

    const grouped = groupMediaByBlipId(rows)

    expect(Object.keys(grouped).sort()).toEqual(["root", "update-1"])
    expect(grouped.root.map(r => r.id)).toEqual(["1", "3"])
    expect(grouped["update-1"].map(r => r.id)).toEqual(["2"])
    expect(grouped["no-media"]).toBeUndefined()
  })
})

describe("flattenBlipPageMedia", () => {
  it("orders root media first, then each update in page order", () => {
    const root = [
      row({ id: "r1", blip_id: "root", display_order: 0 }),
      row({ id: "r2", blip_id: "root", display_order: 1 }),
    ]
    const byBlip = groupMediaByBlipId([
      ...root,
      row({ id: "u2-1", blip_id: "update-2", display_order: 0 }),
      row({ id: "u1-1", blip_id: "update-1", display_order: 0 }),
    ])

    const flat = flattenBlipPageMedia(root, byBlip, ["update-2", "update-1"])

    expect(flat.map(r => r.id)).toEqual(["r1", "r2", "u2-1", "u1-1"])
  })

  it("skips updates with no media", () => {
    const root = [row({ id: "r1", blip_id: "root" })]
    const byBlip = groupMediaByBlipId([
      ...root,
      row({ id: "u1-1", blip_id: "update-1" }),
    ])

    const flat = flattenBlipPageMedia(root, byBlip, ["update-empty", "update-1"])

    expect(flat.map(r => r.id)).toEqual(["r1", "u1-1"])
  })
})

describe("indexMediaById", () => {
  it("maps row ids to flattened indices", () => {
    const media = [
      row({ id: "a" }),
      row({ id: "b" }),
      row({ id: "c" }),
    ]
    const index = indexMediaById(media)

    expect(index.get("a")).toBe(0)
    expect(index.get("b")).toBe(1)
    expect(index.get("c")).toBe(2)
    expect(index.get("missing")).toBeUndefined()
  })
})
