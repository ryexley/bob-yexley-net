import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  CANONICAL_BOOK_NAMES,
  type CanonicalBookName,
} from "@/lib/bible/book-map"
import { normalizeReference } from "@/lib/bible/normalize-reference"
import {
  supaStore,
  type OperationResult,
  type StoreOptions,
} from "@/lib/data/supa-store"
import { referenceSlugFromNormalized } from "@/modules/scripture-references/util/reference-slug"
import { fromReferenceRow, toAdminReferenceRecord } from "./mappers"
import type { BiblePassageReference, ReferenceInput, ReferenceRow } from "./schema"
import type {
  AdminReferenceDeleteResult,
  AdminReferenceMutationResult,
  AdminReferenceRecord,
} from "./types"

const _referenceStore = supaStore<BiblePassageReference>("bible_passage_references")

const canonicalBookSet = new Set<string>(CANONICAL_BOOK_NAMES)

const adminReferenceInputSchema = z
  .object({
    book: z
      .string()
      .trim()
      .min(1)
      .refine((value): value is CanonicalBookName => canonicalBookSet.has(value)),
    chapter: z.number().int().positive(),
    startVerse: z.number().int().positive(),
    endVerse: z.number().int().positive().nullable().optional(),
    collectionNames: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .refine(
    data => data.endVerse == null || data.endVerse >= data.startVerse,
    "End verse must be greater than or equal to the start verse.",
  )

const isUniqueViolation = (error: { code?: string } | null | undefined) =>
  error?.code === "23505"

const REFERENCE_SELECT = `
  id,
  book,
  chapter,
  start_verse,
  end_verse,
  slug,
  created_at,
  updated_at,
  bible_passage_reference_collections (
    collection_id,
    bible_passage_collections ( id, name, slug, deleted_at )
  )
`

const BASE_REFERENCE_SELECT =
  "id, book, chapter, start_verse, end_verse, slug, created_at, updated_at"

async function validateReferenceWithPassageApi(input: {
  book: string
  chapter: number
  startVerse: number
  endVerse: number | null
}): Promise<boolean> {
  const params = new URLSearchParams({
    book: input.book,
    chapter: String(input.chapter),
    start_verse: String(input.startVerse),
    ...(input.endVerse != null ? { end_verse: String(input.endVerse) } : {}),
  })

  try {
    const response = await fetch(`/api/bible/passage?${params}`)
    if (!response.ok) {
      return false
    }

    const data = (await response.json()) as { passage?: string }
    return Boolean(data.passage)
  } catch {
    return false
  }
}

async function fetchReferenceById(
  supabaseClient: SupabaseClient,
  referenceId: number,
): Promise<BiblePassageReference | null> {
  const { data, error } = await supabaseClient
    .from("bible_passage_references")
    .select(REFERENCE_SELECT)
    .eq("id", referenceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return fromReferenceRow(data as unknown as ReferenceRow)
}

async function replaceReferenceCollections(
  supabaseClient: SupabaseClient,
  referenceId: number,
  collectionIds: number[],
): Promise<{ error: string | null }> {
  const nextCollectionIds = [...new Set(collectionIds.filter(Boolean))]

  const { data: existingRows, error: existingError } = await supabaseClient
    .from("bible_passage_reference_collections")
    .select("collection_id")
    .eq("reference_id", referenceId)

  if (existingError) {
    return { error: existingError.message }
  }

  const existingCollectionIds = new Set(
    (existingRows ?? []).map(row => row.collection_id),
  )
  const nextCollectionIdSet = new Set(nextCollectionIds)

  const collectionIdsToDelete = [...existingCollectionIds].filter(
    id => !nextCollectionIdSet.has(id),
  )

  if (collectionIdsToDelete.length > 0) {
    const { error: deleteError } = await supabaseClient
      .from("bible_passage_reference_collections")
      .delete()
      .eq("reference_id", referenceId)
      .in("collection_id", collectionIdsToDelete)

    if (deleteError) {
      return { error: deleteError.message }
    }
  }

  const rowsToInsert = nextCollectionIds
    .filter(id => !existingCollectionIds.has(id))
    .map(collection_id => ({
      reference_id: referenceId,
      collection_id,
    }))

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabaseClient
      .from("bible_passage_reference_collections")
      .insert(rowsToInsert)

    if (insertError) {
      return { error: insertError.message }
    }
  }

  return { error: null }
}

export async function queryReferences(
  supabaseClient: SupabaseClient,
): Promise<BiblePassageReference[]> {
  const { data, error } = await supabaseClient
    .from("bible_passage_references")
    .select(REFERENCE_SELECT)
    .is("deleted_at", null)
    .order("book")
    .order("chapter")
    .order("start_verse")

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as unknown as ReferenceRow[]).map(fromReferenceRow)
}

export function scriptureReferenceStore(
  supabaseClient: SupabaseClient,
  options: StoreOptions = {},
) {
  const store = _referenceStore(supabaseClient, {
    subscribe: false,
    orderBy: "book",
    orderDirection: "asc",
    ...options,
  })

  const mergeIntoCache = (references: BiblePassageReference[]) => {
    store.setInitialData(references)
  }

  const removeFromCache = (referenceId: string) => {
    store.setInitialData(
      store.entities().filter(reference => reference.id !== referenceId),
    )
  }

  const upsertInCache = (reference: BiblePassageReference) => {
    void store.upsert(reference, { cacheOnly: true })
  }

  const resolveCollectionIds = async (
    collectionNames: string[] | undefined,
    upsertCollectionsByName: (
      names: string[],
    ) => Promise<OperationResult<Array<{ id: number; name: string }>>>,
  ): Promise<{ ok: true; collectionIds: number[] } | { ok: false; error: string }> => {
    const result = await upsertCollectionsByName(collectionNames ?? [])
    if (result.error || !result.data) {
      return {
        ok: false,
        error: result.error ?? "Unable to resolve scripture collections right now.",
      }
    }

    return {
      ok: true,
      collectionIds: result.data.map(collection => collection.id),
    }
  }

  const loadAll = async (
    force = false,
  ): Promise<OperationResult<BiblePassageReference[]>> => {
    if (!force && store.entities().length > 0 && !store.error()) {
      return { data: store.entities(), error: null }
    }

    try {
      const references = await queryReferences(supabaseClient)
      mergeIntoCache(references)
      return { data: references, error: null }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load scripture references right now."
      console.error("Failed to load scripture references:", error)
      return { data: null, error: message }
    }
  }

  const createReference = async (
    payload: ReferenceInput,
    upsertCollectionsByName: (
      names: string[],
    ) => Promise<OperationResult<Array<{ id: number; name: string }>>>,
  ): Promise<AdminReferenceMutationResult> => {
    const parsed = adminReferenceInputSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        error: "Please provide a valid book, chapter, and verse range.",
      }
    }

    try {
      const endVerse = parsed.data.endVerse ?? null

      const passageValid = await validateReferenceWithPassageApi({
        book: parsed.data.book,
        chapter: parsed.data.chapter,
        startVerse: parsed.data.startVerse,
        endVerse,
      })

      if (!passageValid) {
        return {
          success: false,
          data: null,
          error:
            "This reference could not be resolved. Verify the chapter and verses, then try again.",
        }
      }

      const normalized = normalizeReference({
        book: parsed.data.book,
        chapter: parsed.data.chapter,
        startVerse: parsed.data.startVerse,
        endVerse,
      })

      const { data, error } = await supabaseClient
        .from("bible_passage_references")
        .insert({
          book: parsed.data.book,
          chapter: parsed.data.chapter,
          start_verse: parsed.data.startVerse,
          end_verse: endVerse,
          slug: referenceSlugFromNormalized(normalized),
        })
        .select(BASE_REFERENCE_SELECT)
        .single()

      if (error) {
        if (isUniqueViolation(error)) {
          return {
            success: false,
            data: null,
            error: "This reference already exists.",
          }
        }

        return {
          success: false,
          data: null,
          error: error.message,
        }
      }

      const referenceId = (data as { id: number }).id
      const collectionResolution = await resolveCollectionIds(
        parsed.data.collectionNames,
        upsertCollectionsByName,
      )

      if (collectionResolution.ok === false) {
        await supabaseClient
          .from("bible_passage_references")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", referenceId)

        return {
          success: false,
          data: null,
          error: collectionResolution.error,
        }
      }

      const replaceResult = await replaceReferenceCollections(
        supabaseClient,
        referenceId,
        collectionResolution.collectionIds,
      )

      if (replaceResult.error) {
        await supabaseClient
          .from("bible_passage_references")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", referenceId)

        return {
          success: false,
          data: null,
          error: replaceResult.error,
        }
      }

      const entity = await fetchReferenceById(supabaseClient, referenceId)
      if (!entity) {
        return {
          success: false,
          data: null,
          error: "Reference not found.",
        }
      }

      upsertInCache(entity)

      return {
        success: true,
        data: toAdminReferenceRecord(entity),
        error: null,
      }
    } catch (error) {
      console.error("Failed to create scripture reference:", error)
      return {
        success: false,
        data: null,
        error: "Unable to create this reference right now.",
      }
    }
  }

  const updateReference = async (
    referenceId: number,
    payload: ReferenceInput,
    upsertCollectionsByName: (
      names: string[],
    ) => Promise<OperationResult<Array<{ id: number; name: string }>>>,
  ): Promise<AdminReferenceMutationResult> => {
    const parsed = adminReferenceInputSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        error: "Please provide a valid book, chapter, and verse range.",
      }
    }

    try {
      const { data: existingReference, error: existingError } = await supabaseClient
        .from("bible_passage_references")
        .select("id")
        .eq("id", referenceId)
        .is("deleted_at", null)
        .maybeSingle()

      if (existingError) {
        return {
          success: false,
          data: null,
          error: existingError.message,
        }
      }

      if (!existingReference) {
        return {
          success: false,
          data: null,
          error: "Reference not found.",
        }
      }

      const endVerse = parsed.data.endVerse ?? null

      const passageValid = await validateReferenceWithPassageApi({
        book: parsed.data.book,
        chapter: parsed.data.chapter,
        startVerse: parsed.data.startVerse,
        endVerse,
      })

      if (!passageValid) {
        return {
          success: false,
          data: null,
          error:
            "This reference could not be resolved. Verify the chapter and verses, then try again.",
        }
      }

      const normalized = normalizeReference({
        book: parsed.data.book,
        chapter: parsed.data.chapter,
        startVerse: parsed.data.startVerse,
        endVerse,
      })

      const { error } = await supabaseClient
        .from("bible_passage_references")
        .update({
          book: parsed.data.book,
          chapter: parsed.data.chapter,
          start_verse: parsed.data.startVerse,
          end_verse: endVerse,
          slug: referenceSlugFromNormalized(normalized),
        })
        .eq("id", referenceId)

      if (error) {
        if (isUniqueViolation(error)) {
          return {
            success: false,
            data: null,
            error: "This reference already exists.",
          }
        }

        return {
          success: false,
          data: null,
          error: error.message,
        }
      }

      const collectionResolution = await resolveCollectionIds(
        parsed.data.collectionNames,
        upsertCollectionsByName,
      )

      if (collectionResolution.ok === false) {
        return {
          success: false,
          data: null,
          error: collectionResolution.error,
        }
      }

      const replaceResult = await replaceReferenceCollections(
        supabaseClient,
        referenceId,
        collectionResolution.collectionIds,
      )

      if (replaceResult.error) {
        return {
          success: false,
          data: null,
          error: replaceResult.error,
        }
      }

      const entity = await fetchReferenceById(supabaseClient, referenceId)
      if (!entity) {
        return {
          success: false,
          data: null,
          error: "Reference not found.",
        }
      }

      upsertInCache(entity)

      return {
        success: true,
        data: toAdminReferenceRecord(entity),
        error: null,
      }
    } catch (error) {
      console.error("Failed to update scripture reference:", error)
      return {
        success: false,
        data: null,
        error: "Unable to save this reference right now.",
      }
    }
  }

  const deleteReference = async (
    referenceId: number,
  ): Promise<AdminReferenceDeleteResult> => {
    try {
      const { data: existingReference, error: existingError } = await supabaseClient
        .from("bible_passage_references")
        .select("id")
        .eq("id", referenceId)
        .is("deleted_at", null)
        .maybeSingle()

      if (existingError) {
        return {
          success: false,
          error: existingError.message,
        }
      }

      if (!existingReference) {
        return {
          success: false,
          error: "Reference not found.",
        }
      }

      const { error } = await supabaseClient
        .from("bible_passage_references")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", referenceId)

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      removeFromCache(String(referenceId))

      return {
        success: true,
        error: null,
      }
    } catch (error) {
      console.error("Failed to delete scripture reference:", error)
      return {
        success: false,
        error: "Unable to delete this reference right now.",
      }
    }
  }

  const adminRecords = (): AdminReferenceRecord[] =>
    store.entities().map(toAdminReferenceRecord)

  return {
    ...store,
    loadAll,
    createReference,
    updateReference,
    deleteReference,
    adminRecords,
    mergeIntoCache,
    removeFromCache,
  }
}
