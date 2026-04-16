import { z } from "zod"
import type { AdminUserRecord, AdminUserUpdateResult, AdminUsersQueryResult } from "./types"
import type { AppRole, UserStatus } from "@/lib/vendor/supabase/user-profile"
import { getAdminClient } from "@/lib/vendor/supabase/admin"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"

type UserProfileRow = {
  id: string
  user_id: string
  display_name: string
  avatar_seed: string | null
  avatar_version: number | null
  created_at: string
}

type UserSystemRow = {
  user_profile_id: string
  status: UserStatus
  trusted: boolean
  notes: string | null
}

type UserRoleRow = {
  user_id: string
  role: AppRole
}

type CurrentAdminRequestContext = {
  authorized: boolean
  currentUserId: string | null
}

const userStatusSchema = z.enum(["pending", "active", "locked"])
const appRoleSchema = z.enum(["visitor", "admin", "superuser"])
const adminUserUpdateSchema = z.object({
  role: appRoleSchema,
  status: userStatusSchema,
  trusted: z.boolean().optional().default(false),
  notes: z.string().max(4000).optional().default(""),
  pin: z.union([z.literal(""), z.string().regex(/^\d{6}$/)]).optional().default(""),
})

const normalizeNotes = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function canCurrentRequestAccessAdminUsers(): Promise<boolean> {
  const access = await getCurrentAdminRequestContext()
  return access.authorized
}

async function getCurrentAdminRequestContext(): Promise<CurrentAdminRequestContext> {
  const supabase = await getServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    return {
      authorized: false,
      currentUserId: null,
    }
  }

  const { data: profile, error: profileError } = await selectUserProfileRecord(
    supabase,
    user.id,
  )

  if (profileError || !profile) {
    return {
      authorized: false,
      currentUserId: user.id,
    }
  }

  return {
    authorized: profile.role === "superuser",
    currentUserId: user.id,
  }
}

async function listAllAuthUsers() {
  const adminClient = getAdminClient()
  const users = new Map<string, string | null>()
  const perPage = 200
  let page = 1

  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw new Error(error.message)
    }

    const batch = data?.users ?? []
    for (const user of batch) {
      users.set(user.id, user.email ?? null)
    }

    if (batch.length < perPage) {
      break
    }

    page += 1
  }

  return users
}

async function listAllUserRoles() {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.from("user_roles").select("user_id, role")

  if (error) {
    throw new Error(error.message)
  }

  return new Map((data as UserRoleRow[]).map(row => [row.user_id, row.role]))
}

async function countSuperusers() {
  const adminClient = getAdminClient()
  const { count, error } = await adminClient
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "superuser")

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

const mapAdminUserRecord = (
  profileRow: UserProfileRow,
  systemRow: UserSystemRow | null,
  email: string | null,
  role: AppRole,
): AdminUserRecord => ({
  userId: profileRow.user_id,
  profileId: profileRow.id,
  role,
  email,
  displayName: profileRow.display_name,
  status: systemRow?.status ?? "pending",
  trusted: systemRow?.trusted ?? false,
  avatarSeed: profileRow.avatar_seed,
  avatarVersion: profileRow.avatar_version,
  notes: systemRow?.notes ?? null,
  createdAt: profileRow.created_at,
})

export async function loadAdminUsers(): Promise<AdminUsersQueryResult> {
  const authorized = await canCurrentRequestAccessAdminUsers()
  if (!authorized) {
    return {
      authorized: false,
      users: [],
      error: null,
    }
  }

  try {
    const adminClient = getAdminClient()
    const { data: profileData, error: profileError } = await adminClient
      .from("user_profile")
      .select("id, user_id, display_name, avatar_seed, avatar_version, created_at")

    if (profileError) {
      throw new Error(profileError.message)
    }

    const { data: systemData, error: systemError } = await adminClient
      .from("user_system")
      .select("user_profile_id, status, trusted, notes")

    if (systemError) {
      throw new Error(systemError.message)
    }

    const profileRows = (profileData ?? []) as UserProfileRow[]
    const systemByProfileId = new Map(
      ((systemData ?? []) as UserSystemRow[]).map(row => [row.user_profile_id, row]),
    )
    const emailByUserId = await listAllAuthUsers()
    const roleByUserId = await listAllUserRoles()

    return {
      authorized: true,
      users: profileRows.map(profileRow =>
        mapAdminUserRecord(
          profileRow,
          systemByProfileId.get(profileRow.id) ?? null,
          emailByUserId.get(profileRow.user_id) ?? null,
          roleByUserId.get(profileRow.user_id) ?? "visitor",
        ),
      ),
      error: null,
    }
  } catch (error) {
    console.error("Failed to load admin users:", error)
    return {
      authorized: true,
      users: [],
      error: "Unable to load users right now.",
    }
  }
}

export async function updateAdminUser(
  userId: string,
  payload: unknown,
): Promise<AdminUserUpdateResult> {
  const access = await getCurrentAdminRequestContext()
  if (!access.authorized) {
    return {
      success: false,
      data: null,
      error: "Unauthorized",
      pinWasReset: false,
    }
  }

  const parsed = adminUserUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      data: null,
      error: "Please provide a valid role, status, notes value, and 6-digit PIN.",
      pinWasReset: false,
    }
  }

  try {
    const adminClient = getAdminClient()
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("user_profile")
      .select("id, user_id, display_name, avatar_seed, avatar_version, created_at")
      .eq("user_id", userId)
      .maybeSingle()

    if (existingProfileError) {
      return {
        success: false,
        data: null,
        error: existingProfileError.message,
        pinWasReset: false,
      }
    }

    if (!existingProfile) {
      return {
        success: false,
        data: null,
        error: "User not found.",
        pinWasReset: false,
      }
    }

    const { data: existingSystem, error: existingSystemError } = await adminClient
      .from("user_system")
      .select("user_profile_id, status, trusted, notes")
      .eq("user_profile_id", existingProfile.id)
      .maybeSingle()

    if (existingSystemError) {
      return {
        success: false,
        data: null,
        error: existingSystemError.message,
        pinWasReset: false,
      }
    }

    const { data: existingRoleRow, error: existingRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle()

    if (existingRoleError) {
      return {
        success: false,
        data: null,
        error: existingRoleError.message,
        pinWasReset: false,
      }
    }

    const existingRole = (existingRoleRow as { role?: AppRole } | null)?.role ?? "visitor"

    if (access.currentUserId === userId && parsed.data.role !== "superuser") {
      return {
        success: false,
        data: null,
        error: "You cannot remove your own superuser role.",
        pinWasReset: false,
      }
    }

    if (existingRole === "superuser" && parsed.data.role !== "superuser") {
      const superuserCount = await countSuperusers()
      if (superuserCount <= 1) {
        return {
          success: false,
          data: null,
          error: "You cannot remove the last remaining superuser.",
          pinWasReset: false,
        }
      }
    }

    const nextNotes = normalizeNotes(parsed.data.notes)
    const pinWasReset = parsed.data.pin.length > 0
    const nextStatus: UserStatus = pinWasReset ? "active" : parsed.data.status
    const nextTrusted =
      parsed.data.role === "admin" || parsed.data.role === "superuser"
        ? true
        : parsed.data.trusted

    const { error: roleUpdateError } = await adminClient
      .from("user_roles")
      .upsert(
        {
          user_id: userId,
          role: parsed.data.role,
        },
        {
          onConflict: "user_id",
        },
      )

    if (roleUpdateError) {
      return {
        success: false,
        data: null,
        error: roleUpdateError.message,
        pinWasReset: false,
      }
    }

    if (pinWasReset) {
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, {
        password: parsed.data.pin,
      })

      if (passwordError) {
        return {
          success: false,
          data: null,
          error: passwordError.message,
          pinWasReset: false,
        }
      }
    }

    const { data: updatedSystem, error: updateError } = await adminClient
      .from("user_system")
      .update({
        status: nextStatus,
        trusted: nextTrusted,
        notes: nextNotes,
      })
      .eq("user_profile_id", existingProfile.id)
      .select("user_profile_id, status, trusted, notes")
      .single()

    if (updateError) {
      return {
        success: false,
        data: null,
        error: updateError.message,
        pinWasReset,
      }
    }

    const { data: authUserResult, error: authUserError } = await adminClient.auth.admin.getUserById(
      userId,
    )

    if (authUserError) {
      return {
        success: false,
        data: null,
        error: authUserError.message,
        pinWasReset,
      }
    }

    return {
      success: true,
      data: mapAdminUserRecord(
        existingProfile as UserProfileRow,
        (updatedSystem ?? existingSystem) as UserSystemRow | null,
        authUserResult.user.email ?? null,
        parsed.data.role,
      ),
      error: null,
      pinWasReset,
    }
  } catch (error) {
    console.error("Failed to update admin user:", error)
    return {
      success: false,
      data: null,
      error: "Unable to save user changes right now.",
      pinWasReset: false,
    }
  }
}
