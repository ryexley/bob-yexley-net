import { z } from "zod"
import type { AdminUserRecord, AdminUserUpdateResult, AdminUsersQueryResult } from "./types"
import type { VisitorStatus } from "@/lib/vendor/supabase/user-profile"
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

const visitorStatusSchema = z.enum(["pending", "active", "locked"])
const adminUserUpdateSchema = z.object({
  status: visitorStatusSchema,
  notes: z.string().max(4000).optional().default(""),
  pin: z.union([z.literal(""), z.string().regex(/^\d{6}$/)]).optional().default(""),
})

const normalizeNotes = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function canCurrentRequestAccessAdminUsers(): Promise<boolean> {
  const supabase = await getServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    return false
  }

  const { data: profile, error: profileError } = await selectUserProfileRecord(
    supabase,
    user.id,
  )

  if (profileError || !profile) {
    return false
  }

  return profile.role === "superuser"
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

const mapAdminUserRecord = (
  row: VisitorRow,
  email: string | null,
): AdminUserRecord => ({
  userId: row.user_id,
  visitorId: row.id,
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

    return {
      authorized: true,
      users: rows.map(row => mapAdminUserRecord(row, emailByUserId.get(row.user_id) ?? null)),
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
  const authorized = await canCurrentRequestAccessAdminUsers()
  if (!authorized) {
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
      error: "Please provide a valid status, notes value, and 6-digit PIN.",
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

    const nextNotes = normalizeNotes(parsed.data.notes)
    const pinWasReset = parsed.data.pin.length > 0
    const nextStatus: VisitorStatus = pinWasReset ? "active" : parsed.data.status

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
