import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  supaStore,
  type OperationResult,
  type StoreOptions,
} from "@/lib/data/supa-store"
import { fromCollectionRow, toAdminCollectionRecord } from "./mappers"
import { collectionSlugFromName } from "@/modules/scripture-collections/util/collection-slug"
import type {
  BiblePassageCollection,
  CollectionRow,
  ReferenceCountRow,
} from "./schema"
import type {
  AdminCollectionDeleteResult,
  AdminCollectionInput,
  AdminCollectionMutationResult,
  AdminCollectionRecord,
} from "./types"

const _collectionStore = supaStore<BiblePassageCollection>(
  "bible_passage_collections",
)

const COLLECTION_NAME_MAX = 64
const COLLECTION_DESCRIPTION_MAX = 256
const COLLECTION_SLUG_MAX = 96

const adminCollectionInputSchema = z.object({
  name: z.string().trim().min(1).max(COLLECTION_NAME_MAX),
  description: z.string().trim().max(COLLECTION_DESCRIPTION_MAX).optional().default(""),
  slug: z.string().trim().min(1).max(COLLECTION_SLUG_MAX),
})

const normalizeDescription = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const isUniqueViolation = (error: { code?: string } | null | undefined) =>
  error?.code === "23505"

const canonicalizeCollectionNames = (values: string[]): string[] => {
  const canonicalized = values.map(value => value.trim()).filter(Boolean)
  const seen = new Set<string>()
  const unique: string[] = []

  for (const value of canonicalized) {
    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(value)
  }

  return unique.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  )
}

async function loadReferenceCountsByCollectionId(
  supabaseClient: SupabaseClient,
) {
  const { data, error } = await supabaseClient
    .from("bible_passage_reference_collections")
    .select("collection_id, bible_passage_references!inner(deleted_at)")
    .is("bible_passage_references.deleted_at", null)

  if (error) {
    throw new Error(error.message)
  }

  const counts = new Map<number, number>()
  for (const row of (data ?? []) as ReferenceCountRow[]) {
    if (row.collection_id == null) {
      continue
    }

    counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1)
  }

  return counts
}

export async function queryCollections(
  supabaseClient: SupabaseClient,
): Promise<BiblePassageCollection[]> {
  const [{ data: collectionData, error: collectionError }, referenceCounts] =
    await Promise.all([
      supabaseClient
        .from("bible_passage_collections")
        .select("id, name, description, slug, created_at, updated_at")
        .is("deleted_at", null)
        .order("name"),
      loadReferenceCountsByCollectionId(supabaseClient),
    ])

  if (collectionError) {
    throw new Error(collectionError.message)
  }

  return ((collectionData ?? []) as CollectionRow[]).map(row =>
    fromCollectionRow(row, referenceCounts.get(row.id) ?? 0),
  )
}

export function scriptureCollectionStore(
  supabaseClient: SupabaseClient,
  options: StoreOptions = {},
) {
  const store = _collectionStore(supabaseClient, {
    subscribe: false,
    orderBy: "name",
    orderDirection: "asc",
    ...options,
  })

  const mergeIntoCache = (collections: BiblePassageCollection[]) => {
    store.setInitialData(collections)
  }

  const removeFromCache = (collectionId: string) => {
    store.setInitialData(
      store.entities().filter(collection => collection.id !== collectionId),
    )
  }

  const upsertInCache = (collection: BiblePassageCollection) => {
    void store.upsert(collection, { cacheOnly: true })
  }

  const loadAll = async (
    force = false,
  ): Promise<OperationResult<BiblePassageCollection[]>> => {
    if (!force && store.entities().length > 0 && !store.error()) {
      return { data: store.entities(), error: null }
    }

    try {
      const collections = await queryCollections(supabaseClient)
      mergeIntoCache(collections)
      return { data: collections, error: null }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load scripture collections right now."
      console.error("Failed to load scripture collections:", error)
      return { data: null, error: message }
    }
  }

  const createCollection = async (
    payload: AdminCollectionInput,
  ): Promise<AdminCollectionMutationResult> => {
    const parsed = adminCollectionInputSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        error: "Please provide a valid name, description, and slug.",
      }
    }

    try {
      const { data, error } = await supabaseClient
        .from("bible_passage_collections")
        .insert({
          name: parsed.data.name,
          description: normalizeDescription(parsed.data.description),
          slug: parsed.data.slug,
        })
        .select("id, name, description, slug, created_at, updated_at")
        .single()

      if (error) {
        if (isUniqueViolation(error)) {
          return {
            success: false,
            data: null,
            error: "A collection with that name or slug already exists.",
          }
        }

        return {
          success: false,
          data: null,
          error: error.message,
        }
      }

      const entity = fromCollectionRow(data as CollectionRow, 0)
      upsertInCache(entity)

      return {
        success: true,
        data: toAdminCollectionRecord(entity),
        error: null,
      }
    } catch (error) {
      console.error("Failed to create scripture collection:", error)
      return {
        success: false,
        data: null,
        error: "Unable to create this collection right now.",
      }
    }
  }

  const updateCollection = async (
    collectionId: number,
    payload: AdminCollectionInput,
  ): Promise<AdminCollectionMutationResult> => {
    const parsed = adminCollectionInputSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        error: "Please provide a valid name, description, and slug.",
      }
    }

    try {
      const { data: existingCollection, error: existingError } = await supabaseClient
        .from("bible_passage_collections")
        .select("id")
        .eq("id", collectionId)
        .is("deleted_at", null)
        .maybeSingle()

      if (existingError) {
        return {
          success: false,
          data: null,
          error: existingError.message,
        }
      }

      if (!existingCollection) {
        return {
          success: false,
          data: null,
          error: "Collection not found.",
        }
      }

      const { data, error } = await supabaseClient
        .from("bible_passage_collections")
        .update({
          name: parsed.data.name,
          description: normalizeDescription(parsed.data.description),
          slug: parsed.data.slug,
        })
        .eq("id", collectionId)
        .select("id, name, description, slug, created_at, updated_at")
        .single()

      if (error) {
        if (isUniqueViolation(error)) {
          return {
            success: false,
            data: null,
            error: "A collection with that name or slug already exists.",
          }
        }

        return {
          success: false,
          data: null,
          error: error.message,
        }
      }

      const referenceCounts = await loadReferenceCountsByCollectionId(supabaseClient)
      const entity = fromCollectionRow(
        data as CollectionRow,
        referenceCounts.get(collectionId) ?? 0,
      )
      upsertInCache(entity)

      return {
        success: true,
        data: toAdminCollectionRecord(entity),
        error: null,
      }
    } catch (error) {
      console.error("Failed to update scripture collection:", error)
      return {
        success: false,
        data: null,
        error: "Unable to save this collection right now.",
      }
    }
  }

  const deleteCollection = async (
    collectionId: number,
  ): Promise<AdminCollectionDeleteResult> => {
    try {
      const deletedAt = new Date().toISOString()

      const { data: existingCollection, error: existingError } = await supabaseClient
        .from("bible_passage_collections")
        .select("id")
        .eq("id", collectionId)
        .is("deleted_at", null)
        .maybeSingle()

      if (existingError) {
        return {
          success: false,
          error: existingError.message,
        }
      }

      if (!existingCollection) {
        return {
          success: false,
          error: "Collection not found.",
        }
      }

      const { error: collectionError } = await supabaseClient
        .from("bible_passage_collections")
        .update({ deleted_at: deletedAt })
        .eq("id", collectionId)

      if (collectionError) {
        return {
          success: false,
          error: collectionError.message,
        }
      }

      removeFromCache(String(collectionId))

      return {
        success: true,
        error: null,
      }
    } catch (error) {
      console.error("Failed to delete scripture collection:", error)
      return {
        success: false,
        error: "Unable to delete this collection right now.",
      }
    }
  }

  const upsertCollectionsByName = async (
    collectionNames: string[],
  ): Promise<OperationResult<Array<{ id: number; name: string }>>> => {
    const names = canonicalizeCollectionNames(collectionNames)
    if (names.length === 0) {
      return { data: [], error: null }
    }

    try {
      const { data: existingRows, error: existingError } = await supabaseClient
        .from("bible_passage_collections")
        .select("id, name")
        .is("deleted_at", null)

      if (existingError) {
        throw new Error(existingError.message)
      }

      const existingByName = new Map<string, { id: number; name: string }>()
      for (const row of existingRows ?? []) {
        existingByName.set(row.name.trim().toLowerCase(), {
          id: row.id,
          name: row.name,
        })
      }

      const resolved: Array<{ id: number; name: string }> = []

      for (const name of names) {
        const existing = existingByName.get(name.toLowerCase())
        if (existing) {
          resolved.push(existing)
          continue
        }

        const created = await createCollection({
          name,
          description: "",
          slug: collectionSlugFromName(name),
        })

        if (!created.success || !created.data) {
          return {
            data: null,
            error: created.error ?? "Unable to create this collection right now.",
          }
        }

        const next = { id: created.data.id, name: created.data.name }
        existingByName.set(name.toLowerCase(), next)
        resolved.push(next)
      }

      return { data: resolved, error: null }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to resolve scripture collections right now."
      console.error("Failed to upsert scripture collections:", error)
      return { data: null, error: message }
    }
  }

  const adminRecords = (): AdminCollectionRecord[] =>
    store.entities().map(toAdminCollectionRecord)

  return {
    ...store,
    loadAll,
    createCollection,
    updateCollection,
    deleteCollection,
    upsertCollectionsByName,
    adminRecords,
    mergeIntoCache,
    removeFromCache,
  }
}
