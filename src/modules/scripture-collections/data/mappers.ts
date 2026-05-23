import type { AdminCollectionRecord } from "./types"
import type { BiblePassageCollection, CollectionRow } from "./schema"

export const fromCollectionRow = (
  row: CollectionRow,
  referenceCount = 0,
): BiblePassageCollection => ({
  id: String(row.id),
  name: row.name,
  description: row.description,
  slug: row.slug,
  created_at: row.created_at,
  updated_at: row.updated_at,
  reference_count: referenceCount,
})

export const toAdminCollectionRecord = (
  entity: BiblePassageCollection,
): AdminCollectionRecord => ({
  id: Number(entity.id),
  name: entity.name,
  description: entity.description,
  slug: entity.slug,
  referenceCount: entity.reference_count ?? 0,
  createdAt: entity.created_at,
  updatedAt: entity.updated_at,
})
