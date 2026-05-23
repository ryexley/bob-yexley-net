import { normalizeReference } from "@/lib/bible/normalize-reference"
import type { AdminReferenceRecord } from "./types"
import type {
  BiblePassageReference,
  ReferenceCollection,
  ReferenceRow,
} from "./schema"

const mapReferenceCollections = (
  row: ReferenceRow,
): ReferenceCollection[] => {
  const collections = new Map<number, ReferenceCollection>()

  for (const link of row.bible_passage_reference_collections ?? []) {
    const collection = link.bible_passage_collections
    if (!collection || collection.deleted_at != null) {
      continue
    }

    collections.set(collection.id, {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
    })
  }

  return [...collections.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  )
}

export const fromReferenceRow = (row: ReferenceRow): BiblePassageReference => ({
  id: String(row.id),
  book: row.book,
  chapter: row.chapter,
  start_verse: row.start_verse,
  end_verse: row.end_verse,
  slug: row.slug,
  created_at: row.created_at,
  updated_at: row.updated_at,
  collections: mapReferenceCollections(row),
})

export const toAdminReferenceRecord = (
  entity: BiblePassageReference,
): AdminReferenceRecord => {
  const normalized = normalizeReference({
    book: entity.book,
    chapter: entity.chapter,
    startVerse: entity.start_verse,
    endVerse: entity.end_verse,
  })

  return {
    id: Number(entity.id),
    book: entity.book,
    chapter: entity.chapter,
    startVerse: entity.start_verse,
    endVerse: entity.end_verse,
    normalized,
    slug: entity.slug,
    collections: [...(entity.collections ?? [])],
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  }
}
