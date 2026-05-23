import { query } from "@solidjs/router"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import { toAdminReferenceRecord } from "./mappers"
import { queryReferences } from "./store"
import type { AdminReferencesQueryResult } from "./types"

async function canCurrentRequestAccessAdminReferences(): Promise<boolean> {
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

export const getAdminReferences = query(async (): Promise<AdminReferencesQueryResult> => {
  "use server"

  const authorized = await canCurrentRequestAccessAdminReferences()
  if (!authorized) {
    return {
      authorized: false,
      references: [],
      error: null,
    }
  }

  try {
    const supabase = await getServerClient()
    const references = await queryReferences(supabase)

    return {
      authorized: true,
      references: references.map(toAdminReferenceRecord),
      error: null,
    }
  } catch (error) {
    console.error("Failed to load admin scripture references:", error)
    return {
      authorized: true,
      references: [],
      error: "Unable to load scripture references right now.",
    }
  }
}, "admin-scripture-references")
