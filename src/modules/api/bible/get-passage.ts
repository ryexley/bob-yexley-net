import { CANONICAL_BOOK_NAMES, type CanonicalBookName } from "@/lib/bible/book-map"
import { fetchEsvPassageText } from "@/lib/bible/esv-api"
import { normalizeReference } from "@/lib/bible/normalize-reference"
import type { ParsedReference } from "@/lib/bible/parse-reference"
import { getAdminClient } from "@/lib/vendor/supabase/admin"
import { getEnv } from "@/util/env"

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const CANONICAL_BOOK_SET = new Set<string>(CANONICAL_BOOK_NAMES)

export type BiblePassageQuery = {
  book: string
  chapter: number
  startVerse: number
  endVerse: number | null
}

export type BiblePassageSuccess = {
  success: true
  reference: string
  passage: string
}

export type BiblePassageFailure = {
  success: false
  error: string
  status: 400 | 500
}

export type BiblePassageResult = BiblePassageSuccess | BiblePassageFailure

type GetBiblePassageOptions = {
  writeCache?: boolean
}

function parseRequiredPositiveInt(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export function parseBiblePassageQuery(
  searchParams: URLSearchParams,
): BiblePassageQuery | null {
  const book = searchParams.get("book")?.trim()
  if (!book || !CANONICAL_BOOK_SET.has(book)) {
    return null
  }

  const chapter = parseRequiredPositiveInt(searchParams.get("chapter"))
  const startVerse = parseRequiredPositiveInt(searchParams.get("start_verse"))
  if (chapter === null || startVerse === null) {
    return null
  }

  const endVerseValue = searchParams.get("end_verse")
  let endVerse: number | null = null
  if (endVerseValue !== null && endVerseValue.trim() !== "") {
    const parsedEndVerse = parseRequiredPositiveInt(endVerseValue)
    if (parsedEndVerse === null || parsedEndVerse < startVerse) {
      return null
    }

    endVerse = parsedEndVerse
  }

  return {
    book,
    chapter,
    startVerse,
    endVerse,
  }
}

function toParsedReference(query: BiblePassageQuery): ParsedReference {
  return {
    book: query.book,
    chapter: query.chapter,
    startVerse: query.startVerse,
    endVerse: query.endVerse,
  }
}

async function getCachedPassage(reference: string): Promise<string | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString()
  const { data, error } = await getAdminClient()
    .from("esv_passage_cache")
    .select("passage_text")
    .eq("reference", reference)
    .gt("cached_at", cutoff)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.passage_text ?? null
}

async function cachePassage(reference: string, passageText: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("esv_passage_cache")
    .upsert(
      {
        reference,
        passage_text: passageText,
        cached_at: new Date().toISOString(),
      },
      { onConflict: "reference" },
    )

  if (error) {
    throw error
  }
}

export async function getBiblePassage(
  query: BiblePassageQuery,
  options: GetBiblePassageOptions = {},
): Promise<BiblePassageResult> {
  const writeCache = options.writeCache ?? true
  const reference = normalizeReference(toParsedReference(query))

  try {
    const cachedPassage = await getCachedPassage(reference)
    if (cachedPassage) {
      return {
        success: true,
        reference,
        passage: cachedPassage,
      }
    }

    const apiKey = getEnv().ESV_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: "Failed to fetch passage",
        status: 500,
      }
    }

    const passage = await fetchEsvPassageText(reference, apiKey)
    if (!passage) {
      return {
        success: false,
        error: "Failed to fetch passage",
        status: 500,
      }
    }

    if (writeCache) {
      await cachePassage(reference, passage)
    }

    return {
      success: true,
      reference,
      passage,
    }
  } catch (error) {
    console.error("[bible-passage]", {
      reference,
      error,
    })

    return {
      success: false,
      error: "Failed to fetch passage",
      status: 500,
    }
  }
}

export function isCanonicalBookName(book: string): book is CanonicalBookName {
  return CANONICAL_BOOK_SET.has(book)
}
