export type AdminReferenceCollection = {
  id: number
  name: string
  slug: string
}

export type AdminReferenceRecord = {
  id: number
  book: string
  chapter: number
  startVerse: number
  endVerse: number | null
  normalized: string
  slug: string
  collections: AdminReferenceCollection[]
  createdAt: string
  updatedAt: string
}

export type AdminReferencesQueryResult = {
  authorized: boolean
  references: AdminReferenceRecord[]
  error: string | null
}

export type AdminReferenceInput = {
  book: string
  chapter: number
  startVerse: number
  endVerse?: number | null
  collectionNames?: string[]
}

export type AdminReferenceMutationResult = {
  success: boolean
  data: AdminReferenceRecord | null
  error: string | null
}

export type AdminReferenceDeleteResult = {
  success: boolean
  error: string | null
}

export type ReferenceCollectionFilter = "all" | "uncollected" | number
export type ReferenceSortField = "normalized" | "createdAt"
export type SortDirection = "asc" | "desc"
