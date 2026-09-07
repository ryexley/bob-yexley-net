import { query } from "@solidjs/router"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import { toAdminReferenceRecord } from "./mappers"
import { queryReferences } from "./store"
import type { AdminReferencesQueryResult } from "./types"

export const getAdminReferences = query(async (): Promise<AdminReferencesQueryResult> => {
  "use server"

  const { getServerClient } = await import("@/lib/vendor/supabase/server")
  const supabase = await getServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    return {
      authorized: false,
      references: [],
      error: null,
    }
  }

  const { data: profile, error: profileError } = await selectUserProfileRecord(
    supabase,
    user.id,
  )

  if (profileError || !profile || profile.role !== "superuser") {
    return {
      authorized: false,
      references: [],
      error: null,
    }
  }

  try {
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
