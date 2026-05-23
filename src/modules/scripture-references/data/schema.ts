import { z } from "zod"

export const referenceCollectionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
})

export type ReferenceCollection = z.infer<typeof referenceCollectionSchema>

export const biblePassageReferenceSchema = z.object({
  id: z.string(),
  book: z.string(),
  chapter: z.number().int().positive(),
  start_verse: z.number().int().positive(),
  end_verse: z.number().int().positive().nullable(),
  slug: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  collections: z.array(referenceCollectionSchema).optional(),
})

export type BiblePassageReference = z.infer<typeof biblePassageReferenceSchema>

export type ReferenceCollectionLinkRow = {
  collection_id: number
  bible_passage_collections: {
    id: number
    name: string
    slug: string
    deleted_at: string | null
  } | null
}

export type ReferenceRow = {
  id: number
  book: string
  chapter: number
  start_verse: number
  end_verse: number | null
  slug: string
  created_at: string
  updated_at: string
  bible_passage_reference_collections: ReferenceCollectionLinkRow[] | null
}

export type ReferenceInput = {
  book: string
  chapter: number
  startVerse: number
  endVerse?: number | null
  collectionNames?: string[]
}
