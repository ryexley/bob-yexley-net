import { query } from "@solidjs/router"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import { toAdminCollectionRecord } from "./mappers"
import { queryCollections } from "./store"
import type { AdminCollectionsQueryResult } from "./types"

export const getAdminCollections = query(async (): Promise<AdminCollectionsQueryResult> => {
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
      collections: [],
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
      collections: [],
      error: null,
    }
  }

  try {
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
