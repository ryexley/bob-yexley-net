import type { VisitorStatus } from "@/lib/vendor/supabase/browser"

export type AdminUserRecord = {
  userId: string
  visitorId: string
  email: string | null
  displayName: string
  status: VisitorStatus
  notes: string | null
  createdAt: string
}

export type AdminUsersQueryResult = {
  authorized: boolean
  users: AdminUserRecord[]
  error: string | null
}

export type AdminUserUpdateInput = {
  status: VisitorStatus
  notes: string
  pin?: string
}

export type AdminUserUpdateResult = {
  success: boolean
  data: AdminUserRecord | null
  error: string | null
  pinWasReset: boolean
}

export type UserStatusFilter = VisitorStatus | "all"
export type UserSortField = "createdAt" | "displayName"
export type SortDirection = "asc" | "desc"
