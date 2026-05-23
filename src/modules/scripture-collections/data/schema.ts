import { z } from "zod"

export const biblePassageCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  slug: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  reference_count: z.number().int().nonnegative().optional(),
})

export type BiblePassageCollection = z.infer<typeof biblePassageCollectionSchema>

export type CollectionRow = {
  id: number
  name: string
  description: string | null
  slug: string
  created_at: string
  updated_at: string
}

export type ReferenceCountRow = {
  collection_id: number | null
}
