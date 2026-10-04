export type AdminTagRecord = {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  blipCount: number
  createdAt: string
  updatedAt: string
}

export type AdminTagsQueryResult = {
  authorized: boolean
  tags: AdminTagRecord[]
  error: string | null
}

export type AdminTagUpdateResult = {
  success: boolean
  data: AdminTagRecord | null
  error: string | null
  conflictingTagId?: string
}

export type MergeTagsResult = {
  success: boolean
  error: string | null
}
