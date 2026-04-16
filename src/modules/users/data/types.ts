import type { AppRole, UserStatus } from "@/lib/vendor/supabase/browser"

export type AdminUserRecord = {
  userId: string
  profileId: string
  role: AppRole
  email: string | null
  displayName: string
  status: UserStatus
  trusted?: boolean
  avatarSeed?: string | null
  avatarVersion?: number | null
  notes: string | null
  createdAt: string
}

export type AdminUsersQueryResult = {
  authorized: boolean
  users: AdminUserRecord[]
  error: string | null
}

export type AdminUserUpdateInput = {
  role: AppRole
  status: UserStatus
  trusted: boolean
  notes: string
  pin?: string
}

export type AdminUserUpdateResult = {
  success: boolean
  data: AdminUserRecord | null
  error: string | null
  pinWasReset: boolean
}

export type UserStatusFilter = UserStatus | "all"
export type UserSortField = "createdAt" | "displayName"
export type SortDirection = "asc" | "desc"
