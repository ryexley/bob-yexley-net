export type AdminCollectionRecord = {
  id: number
  name: string
  description: string | null
  slug: string
  referenceCount: number
  createdAt: string
  updatedAt: string
}

export type AdminCollectionsQueryResult = {
  authorized: boolean
  collections: AdminCollectionRecord[]
  error: string | null
}

export type AdminCollectionInput = {
  name: string
  description: string
  slug: string
}

export type AdminCollectionMutationResult = {
  success: boolean
  data: AdminCollectionRecord | null
  error: string | null
}

export type AdminCollectionDeleteResult = {
  success: boolean
  error: string | null
}

export type CollectionSortField = "name" | "createdAt"
export type SortDirection = "asc" | "desc"
