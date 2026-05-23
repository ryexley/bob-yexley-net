import { query } from "@solidjs/router"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import { toAdminCollectionRecord } from "./mappers"
import { queryCollections } from "./store"
import type { AdminCollectionsQueryResult } from "./types"

async function canCurrentRequestAccessAdminCollections(): Promise<boolean> {
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

export const getAdminCollections = query(async (): Promise<AdminCollectionsQueryResult> => {
  "use server"

  const authorized = await canCurrentRequestAccessAdminCollections()
  if (!authorized) {
    return {
      authorized: false,
      collections: [],
      error: null,
    }
  }

  try {
    const supabase = await getServerClient()
    const collections = await queryCollections(supabase)

    return {
      authorized: true,
      collections: collections.map(toAdminCollectionRecord),
      error: null,
    }
  } catch (error) {
    console.error("Failed to load admin scripture collections:", error)
    return {
      authorized: true,
      collections: [],
      error: "Unable to load scripture collections right now.",
    }
  }
}, "admin-scripture-collections")
