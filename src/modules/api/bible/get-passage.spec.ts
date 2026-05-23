import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getBiblePassage,
  parseBiblePassageQuery,
} from "@/modules/api/bible/get-passage"

const { cacheRow, cacheError, upsertError } = vi.hoisted(() => ({
  cacheRow: {
    value: null as { passage_text: string } | null,
  },
  cacheError: {
    value: null as { message: string } | null,
  },
  upsertError: {
    value: null as { message: string } | null,
  },
}))

const maybeSingle = vi.fn(async () => ({
  data: cacheRow.value,
  error: cacheError.value,
}))
const upsert = vi.fn(async () => ({
  error: upsertError.value,
}))
const eq = vi.fn(() => ({ gt: gtMock }))
const gtMock = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({
  select,
  upsert,
}))

vi.mock("@/lib/vendor/supabase/admin", () => ({
  getAdminClient: () => ({
    from,
  }),
}))

vi.mock("@/lib/bible/esv-api", () => ({
  fetchEsvPassageText: vi.fn(),
}))

vi.mock("@/util/env", () => ({
  getEnv: vi.fn(() => ({
    ESV_API_KEY: "test-esv-key",
  })),
}))

import { fetchEsvPassageText } from "@/lib/bible/esv-api"
import { getEnv } from "@/util/env"

const mockedFetchEsvPassageText = vi.mocked(fetchEsvPassageText)
const mockedGetEnv = vi.mocked(getEnv)

describe("parseBiblePassageQuery", () => {
  it("parses required and optional query params", () => {
    expect(
      parseBiblePassageQuery(
        new URLSearchParams("book=Romans&chapter=8&start_verse=28&end_verse=30"),
      ),
    ).toEqual({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: 30,
    })

    expect(
      parseBiblePassageQuery(
        new URLSearchParams("book=Jude&chapter=1&start_verse=3"),
      ),
    ).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 3,
      endVerse: null,
    })
  })

  it("accepts numbered and multi-word canonical book names", () => {
    expect(
      parseBiblePassageQuery(
        new URLSearchParams("book=1+Samuel&chapter=7&start_verse=12"),
      ),
    ).toEqual({
      book: "1 Samuel",
      chapter: 7,
      startVerse: 12,
      endVerse: null,
    })
  })

  it.each([
    "book=Romans&start_verse=28&end_verse=30",
    "book=Romans&chapter=8&end_verse=30",
    "book=NotABook&chapter=8&start_verse=28",
    "book=Romans&chapter=0&start_verse=28",
    "book=Romans&chapter=8&start_verse=0",
    "book=Romans&chapter=8&start_verse=28&end_verse=10",
  ])("returns null for invalid params: %s", query => {
    expect(parseBiblePassageQuery(new URLSearchParams(query))).toBeNull()
  })
})

describe("getBiblePassage", () => {
  beforeEach(() => {
    cacheRow.value = null
    cacheError.value = null
    upsertError.value = null
    mockedFetchEsvPassageText.mockReset()
    mockedGetEnv.mockReturnValue({
      ESV_API_KEY: "test-esv-key",
    } as ReturnType<typeof getEnv>)
    from.mockClear()
    select.mockClear()
    eq.mockClear()
    gtMock.mockClear()
    maybeSingle.mockClear()
    upsert.mockClear()
  })

  it("returns a fresh cache hit without calling ESV", async () => {
    cacheRow.value = {
      passage_text: "Cached Romans 8:28 text",
    }

    const result = await getBiblePassage({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: null,
    })

    expect(result).toEqual({
      success: true,
      reference: "Romans 8:28",
      passage: "Cached Romans 8:28 text",
    })
    expect(mockedFetchEsvPassageText).not.toHaveBeenCalled()
    expect(from).toHaveBeenCalledWith("esv_passage_cache")
    expect(eq).toHaveBeenCalledWith("reference", "Romans 8:28")
  })

  it("fetches from ESV and upserts on cache miss", async () => {
    mockedFetchEsvPassageText.mockResolvedValue("And we know that for those who love God...")

    const result = await getBiblePassage({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: 30,
    })

    expect(result).toEqual({
      success: true,
      reference: "Romans 8:28-30",
      passage: "And we know that for those who love God...",
    })
    expect(mockedFetchEsvPassageText).toHaveBeenCalledWith(
      "Romans 8:28-30",
      "test-esv-key",
    )
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "Romans 8:28-30",
        passage_text: "And we know that for those who love God...",
      }),
      { onConflict: "reference" },
    )
  })

  it("fetches from ESV without upserting when writeCache is false", async () => {
    mockedFetchEsvPassageText.mockResolvedValue("And we know that for those who love God...")

    const result = await getBiblePassage(
      {
        book: "Romans",
        chapter: 8,
        startVerse: 28,
        endVerse: 30,
      },
      { writeCache: false },
    )

    expect(result).toEqual({
      success: true,
      reference: "Romans 8:28-30",
      passage: "And we know that for those who love God...",
    })
    expect(mockedFetchEsvPassageText).toHaveBeenCalledWith(
      "Romans 8:28-30",
      "test-esv-key",
    )
    expect(upsert).not.toHaveBeenCalled()
  })

  it("returns 500 when ESV fetch fails", async () => {
    mockedFetchEsvPassageText.mockResolvedValue(null)

    const result = await getBiblePassage({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: null,
    })

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch passage",
      status: 500,
    })
  })

  it("returns 500 when the ESV API key is missing on cache miss", async () => {
    mockedGetEnv.mockReturnValueOnce({
      ESV_API_KEY: "",
    } as ReturnType<typeof getEnv>)

    const result = await getBiblePassage({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: null,
    })

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch passage",
      status: 500,
    })
    expect(mockedFetchEsvPassageText).not.toHaveBeenCalled()
  })

  it("returns cached passage even when the ESV API key is missing", async () => {
    cacheRow.value = {
      passage_text: "Cached Romans 8:28 text",
    }
    mockedGetEnv.mockReturnValueOnce({
      ESV_API_KEY: "",
    } as ReturnType<typeof getEnv>)

    const result = await getBiblePassage({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: null,
    })

    expect(result).toEqual({
      success: true,
      reference: "Romans 8:28",
      passage: "Cached Romans 8:28 text",
    })
    expect(mockedFetchEsvPassageText).not.toHaveBeenCalled()
  })
})
