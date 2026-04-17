import type { User } from "@supabase/supabase-js"
import type { AppSupabaseClient } from "@/lib/vendor/supabase/types"

export type AppRole = "superuser" | "admin" | "visitor"
export type UserStatus = "pending" | "active" | "locked"
export type VisitorStatus = UserStatus

type UserProfileViewRow = {
  user_id?: string | null
  role?: AppRole | null
  role_created_at?: string | null
  role_updated_at?: string | null
  profile_id?: string | null
  display_name?: string | null
  status?: UserStatus | null
  failed_login_attempts?: number | null
  notes?: string | null
  trusted?: boolean | null
  avatar_seed?: string | null
  avatar_version?: number | null
  profile_created_at?: string | null
  profile_updated_at?: string | null
  system_created_at?: string | null
  system_updated_at?: string | null
}

type UserRoleRow = {
  role?: AppRole | null
}

type UserProfileRow = {
  id?: string | null
  display_name?: string | null
  avatar_seed?: string | null
  avatar_version?: number | null
  created_at?: string | null
  updated_at?: string | null
}

type UserSystemRow = {
  status?: UserStatus | null
  failed_login_attempts?: number | null
  notes?: string | null
  trusted?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

export type UserProfileRecord = {
  userId: string
  role: AppRole
  roleCreatedAt: string | null
  roleUpdatedAt: string | null
  profileId: string | null
  displayName: string | null
  status: UserStatus | null
  failedLoginAttempts: number | null
  notes: string | null
  trusted: boolean | null
  avatarSeed: string | null
  avatarVersion: number | null
  profileCreatedAt: string | null
  profileUpdatedAt: string | null
  systemCreatedAt: string | null
  systemUpdatedAt: string | null
}

export type UserProfile = {
  user: {
    id: string
    email: string | null
  }
  role: AppRole
  roleCreatedAt: string | null
  roleUpdatedAt: string | null
  profile: {
    id: string | null
    displayName: string | null
    avatarSeed: string | null
    avatarVersion: number | null
    createdAt: string | null
    updatedAt: string | null
  }
  system: {
    status: UserStatus | null
    failedLoginAttempts: number | null
    notes: string | null
    trusted: boolean | null
    createdAt: string | null
    updatedAt: string | null
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
    profileId: row?.profile_id ?? null,
    displayName: row?.display_name ?? null,
    status: row?.status ?? null,
    failedLoginAttempts: row?.failed_login_attempts ?? null,
    notes: row?.notes ?? null,
    trusted: row?.trusted ?? null,
    avatarSeed: row?.avatar_seed ?? null,
    avatarVersion: row?.avatar_version ?? null,
    profileCreatedAt: row?.profile_created_at ?? null,
    profileUpdatedAt: row?.profile_updated_at ?? null,
    systemCreatedAt: row?.system_created_at ?? null,
    systemUpdatedAt: row?.system_updated_at ?? null,
  }
}

async function selectUserProfileFromView(
  supabase: AppSupabaseClient,
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
        "profile_id",
        "display_name",
        "status",
        "failed_login_attempts",
        "notes",
        "trusted",
        "avatar_seed",
        "avatar_version",
        "profile_created_at",
        "profile_updated_at",
        "system_created_at",
        "system_updated_at",
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
  supabase: AppSupabaseClient,
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

  const { data: profileData, error: profileError } = await supabase
    .from("user_profile")
    .select("id, display_name, avatar_seed, avatar_version, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (profileError) {
    return { data: null, error: profileError.message }
  }

  const profile = profileData as UserProfileRow | null
  const { data: systemData, error: systemError } =
    profile?.id
      ? await supabase
          .from("user_system")
          .select("status, failed_login_attempts, notes, trusted, created_at, updated_at")
          .eq("user_profile_id", profile.id)
          .maybeSingle()
      : { data: null, error: null }

  if (systemError) {
    return { data: null, error: systemError.message }
  }

  const system = systemData as UserSystemRow | null
  const role =
    (roleData as UserRoleRow | null)?.role ??
    (profile?.id ? ("visitor" as AppRole) : null)

  if (!role) {
    return { data: null, error: null }
  }

  return {
    data: {
      userId,
      role,
      roleCreatedAt: null,
      roleUpdatedAt: null,
      profileId: profile?.id ?? null,
      displayName: profile?.display_name ?? null,
      status: system?.status ?? null,
      failedLoginAttempts: system?.failed_login_attempts ?? null,
      notes: system?.notes ?? null,
      trusted: system?.trusted ?? null,
      avatarSeed: profile?.avatar_seed ?? null,
      avatarVersion: profile?.avatar_version ?? null,
      profileCreatedAt: profile?.created_at ?? null,
      profileUpdatedAt: profile?.updated_at ?? null,
      systemCreatedAt: system?.created_at ?? null,
      systemUpdatedAt: system?.updated_at ?? null,
    },
    error: null,
  }
}

export async function selectUserProfileRecord(
  supabase: AppSupabaseClient,
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
    profile: {
      id: record.profileId,
      displayName: record.displayName,
      avatarSeed: record.avatarSeed,
      avatarVersion: record.avatarVersion,
      createdAt: record.profileCreatedAt,
      updatedAt: record.profileUpdatedAt,
    },
    system: {
      status: record.status,
      failedLoginAttempts: record.failedLoginAttempts,
      notes: record.notes,
      trusted: record.trusted,
      createdAt: record.systemCreatedAt,
      updatedAt: record.systemUpdatedAt,
    },
  }
}
