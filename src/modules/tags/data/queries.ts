import { query } from "@solidjs/router"
import type { AdminTagsQueryResult } from "./types"

export const getAdminTags = query(async (): Promise<AdminTagsQueryResult> => {
  "use server"

  const { loadAdminTags } = await import("./server")
  return loadAdminTags()
}, "admin-tags")
