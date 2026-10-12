import { query } from "@solidjs/router"
import { rememberRequestAuthProfile } from "@/lib/vendor/supabase/request-auth-profile"
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
      rememberRequestAuthProfile(null)
      return null
    }

    const { data, error } = await selectUserProfileRecord(
      client,
      user.id,
    )

    if (error) {
      console.error("Failed to load current user profile:", error)
      rememberRequestAuthProfile(null)
      return null
    }

    if (!data) {
      rememberRequestAuthProfile(null)
      return null
    }

    const profile = buildUserProfile(data, user)
    rememberRequestAuthProfile(profile)
    return profile
  } catch (error) {
    console.error("getUserProfile query failed:", error)
    rememberRequestAuthProfile(null)
    return null
  }
}, "user-profile")
