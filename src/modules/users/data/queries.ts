import { query } from "@solidjs/router"
import type { AdminUsersQueryResult } from "./types"
import { loadAdminUsers } from "./server"

export const getAdminUsers = query(async (): Promise<AdminUsersQueryResult> => {
  "use server"

  return loadAdminUsers()
}, "admin-users")
