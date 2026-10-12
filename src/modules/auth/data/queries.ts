import { query } from "@solidjs/router"
import {
  buildUserProfile,
  selectUserProfileRecord,
  type UserProfile,
} from "@/lib/vendor/supabase/user-profile"

export const getUserProfile = query(async (): Promise<UserProfile | null> => {
  "use server"

  try {
    const { getServerAuth } = await import("@/lib/vendor/supabase/server")
    const { client, user } = await getServerAuth()

    if (!user?.id) {
      return null
    }

    const { data, error } = await selectUserProfileRecord(
      client,
      user.id,
    )

    if (error) {
      console.error("Failed to load current user profile:", error)
      return null
    }

    if (!data) {
      return null
    }

    return buildUserProfile(data, user)
  } catch (error) {
    console.error("getUserProfile query failed:", error)
    return null
  }
}, "user-profile")
