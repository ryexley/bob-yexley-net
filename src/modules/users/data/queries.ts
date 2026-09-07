import { query } from "@solidjs/router"
import type { AdminUsersQueryResult } from "./types"

export const getAdminUsers = query(async (): Promise<AdminUsersQueryResult> => {
  "use server"

  const { loadAdminUsers } = await import("./server")
  return loadAdminUsers()
}, "admin-users")
