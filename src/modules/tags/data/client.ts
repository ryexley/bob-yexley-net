"use server"

import type { AdminTagUpdateResult, MergeTagsResult } from "./types"

export async function updateAdminTagRecord(
  tagId: string,
  payload: {
    name: string
    description?: string | null
    coverImage?: string | null
  },
): Promise<AdminTagUpdateResult> {
  const { updateAdminTag } = await import("./server")
  return updateAdminTag(tagId, payload)
}

export async function mergeAdminTags(payload: {
  sourceId: string
  targetId: string
}): Promise<MergeTagsResult> {
  const { mergeTags } = await import("./server")
  return mergeTags(payload)
}
