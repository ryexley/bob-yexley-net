import type { SupabaseClient, User } from "@supabase/supabase-js"

export type AppRole = "superuser" | "admin" | "visitor"
export type VisitorStatus = "pending" | "active" | "locked"

type UserProfileViewRow = {
  user_id?: string | null
  role?: AppRole | null
  role_created_at?: string | null
  role_updated_at?: string | null
  visitor_id?: string | null
  visitor_display_name?: string | null
  visitor_status?: VisitorStatus | null
  visitor_failed_login_attempts?: number | null
  visitor_notes?: string | null
  visitor_created_at?: string | null
}

type UserRoleRow = {
  role?: AppRole | null
}

type VisitorRow = {
  id?: string | null
  display_name?: string | null
  status?: VisitorStatus | null
  failed_login_attempts?: number | null
  notes?: string | null
  created_at?: string | null
}

export type UserProfileRecord = {
  userId: string
  role: AppRole
  roleCreatedAt: string | null
  roleUpdatedAt: string | null
  visitorId: string | null
  visitorDisplayName: string | null
  visitorStatus: VisitorStatus | null
  visitorFailedLoginAttempts: number | null
  visitorNotes: string | null
  visitorCreatedAt: string | null
}

export type UserProfile = {
  user: {
    id: string
    email: string | null
  }
  role: AppRole
  roleCreatedAt: string | null
  roleUpdatedAt: string | null
  visitor: {
    id: string | null
    displayName: string | null
    status: VisitorStatus | null
    failedLoginAttempts: number | null
    notes: string | null
    createdAt: string | null
  }
}

type ProfileLookupResult = {
  data: UserProfileRecord | null
  error: string | null
}

const USER_PROFILE_VIEW_NAME = "view_user" as const

let userProfileViewAvailable: boolean | null = null

const isMissingRelationError = (error: { code?: string; message?: string } | null) =>
  error?.code === "42P01" || /does not exist/i.test(error?.message ?? "")

const mapUserProfileRow = (
  userId: string,
  row: UserProfileViewRow | null,
): UserProfileRecord | null => {
  const role = row?.role ?? null
  if (!role) {
    return null
  }

  return {
    userId,
    role,
    roleCreatedAt: row?.role_created_at ?? null,
    roleUpdatedAt: row?.role_updated_at ?? null,
    visitorId: row?.visitor_id ?? null,
    visitorDisplayName: row?.visitor_display_name ?? null,
    visitorStatus: row?.visitor_status ?? null,
    visitorFailedLoginAttempts: row?.visitor_failed_login_attempts ?? null,
    visitorNotes: row?.visitor_notes ?? null,
    visitorCreatedAt: row?.visitor_created_at ?? null,
  }
}

async function selectUserProfileFromView(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileLookupResult> {
  if (userProfileViewAvailable === false) {
    return { data: null, error: null }
  }

  const { data, error } = await supabase
    .from(USER_PROFILE_VIEW_NAME)
    .select(
      [
        "user_id",
        "role",
        "role_created_at",
        "role_updated_at",
        "visitor_id",
        "visitor_display_name",
        "visitor_status",
        "visitor_failed_login_attempts",
        "visitor_notes",
        "visitor_created_at",
      ].join(", "),
    )
    .maybeSingle()

  if (!error) {
    userProfileViewAvailable = true
    return {
      data: mapUserProfileRow(userId, data as UserProfileViewRow | null),
      error: null,
    }
  }

  if (!isMissingRelationError(error)) {
    return { data: null, error: error.message }
  }

  userProfileViewAvailable = false
  return { data: null, error: error.message }
}

async function selectUserProfileFromTables(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileLookupResult> {
  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()

  if (roleError) {
    return { data: null, error: roleError.message }
  }

  const { data: visitorData, error: visitorError } = await supabase
    .from("visitors")
    .select("id, display_name, status, failed_login_attempts, notes, created_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (visitorError) {
    return { data: null, error: visitorError.message }
  }

  const visitor = visitorData as VisitorRow | null
  const role =
    (roleData as UserRoleRow | null)?.role ??
    (visitor?.id ? ("visitor" as AppRole) : null)

  if (!role) {
    return { data: null, error: null }
  }

  return {
    data: {
      userId,
      role,
      roleCreatedAt: null,
      roleUpdatedAt: null,
      visitorId: visitor?.id ?? null,
      visitorDisplayName: visitor?.display_name ?? null,
      visitorStatus: visitor?.status ?? null,
      visitorFailedLoginAttempts: visitor?.failed_login_attempts ?? null,
      visitorNotes: visitor?.notes ?? null,
      visitorCreatedAt: visitor?.created_at ?? null,
    },
    error: null,
  }
}

export async function selectUserProfileRecord(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileLookupResult> {
  const fromView = await selectUserProfileFromView(supabase, userId)
  if (fromView.data) {
    return fromView
  }

  if (fromView.error && userProfileViewAvailable !== false) {
    return fromView
  }

  return selectUserProfileFromTables(supabase, userId)
}

export function buildUserProfile(
  record: UserProfileRecord,
  user: Pick<User, "id" | "email">,
): UserProfile {
  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    role: record.role,
    roleCreatedAt: record.roleCreatedAt,
    roleUpdatedAt: record.roleUpdatedAt,
    visitor: {
      id: record.visitorId,
      displayName: record.visitorDisplayName,
      status: record.visitorStatus,
      failedLoginAttempts: record.visitorFailedLoginAttempts,
      notes: record.visitorNotes,
      createdAt: record.visitorCreatedAt,
    },
  }
}
