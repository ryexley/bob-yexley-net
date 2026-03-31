import { z } from "zod"
import type { AdminUserRecord, AdminUserUpdateResult, AdminUsersQueryResult } from "./types"
import type { AppRole, VisitorStatus } from "@/lib/vendor/supabase/user-profile"
import { getAdminClient } from "@/lib/vendor/supabase/admin"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"

type VisitorRow = {
  id: string
  user_id: string
  display_name: string
  status: VisitorStatus
  notes: string | null
  created_at: string
}

type UserRoleRow = {
  user_id: string
  role: AppRole
}

type CurrentAdminRequestContext = {
  authorized: boolean
  currentUserId: string | null
}

const visitorStatusSchema = z.enum(["pending", "active", "locked"])
const appRoleSchema = z.enum(["visitor", "admin", "superuser"])
const adminUserUpdateSchema = z.object({
  role: appRoleSchema,
  status: visitorStatusSchema,
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
  row: VisitorRow,
  email: string | null,
  role: AppRole,
): AdminUserRecord => ({
  userId: row.user_id,
  visitorId: row.id,
  role,
  email,
  displayName: row.display_name,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at,
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
    const { data, error } = await adminClient
      .from("visitors")
      .select("id, user_id, display_name, status, notes, created_at")

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as VisitorRow[]
    const emailByUserId = await listAllAuthUsers()
    const roleByUserId = await listAllUserRoles()

    return {
      authorized: true,
      users: rows.map(row =>
        mapAdminUserRecord(
          row,
          emailByUserId.get(row.user_id) ?? null,
          roleByUserId.get(row.user_id) ?? "visitor",
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
    const { data: existingVisitor, error: existingVisitorError } = await adminClient
      .from("visitors")
      .select("id, user_id, display_name, status, notes, created_at")
      .eq("user_id", userId)
      .maybeSingle()

    if (existingVisitorError) {
      return {
        success: false,
        data: null,
        error: existingVisitorError.message,
        pinWasReset: false,
      }
    }

    if (!existingVisitor) {
      return {
        success: false,
        data: null,
        error: "User not found.",
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
    const nextStatus: VisitorStatus = pinWasReset ? "active" : parsed.data.status

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

    const { data: updatedVisitor, error: updateError } = await adminClient
      .from("visitors")
      .update({
        status: nextStatus,
        notes: nextNotes,
      })
      .eq("user_id", userId)
      .select("id, user_id, display_name, status, notes, created_at")
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
        updatedVisitor as VisitorRow,
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
