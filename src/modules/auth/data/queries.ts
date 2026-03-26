import { query } from "@solidjs/router"
import {
  buildUserProfile,
  selectUserProfileRecord,
  type UserProfile,
} from "@/lib/vendor/supabase/user-profile"

const isMissingAuthSessionError = (error: { name?: string; message?: string } | null) =>
  error?.name === "AuthSessionMissingError" ||
  /auth session missing/i.test(error?.message ?? "")

export const getUserProfile = query(async (): Promise<UserProfile | null> => {
  "use server"

  try {
    const { getServerClient } = await import("@/lib/vendor/supabase/server")
    const supabase = await getServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      if (isMissingAuthSessionError(userError)) {
        return null
      }

      console.error("Failed to authenticate current user profile request:", userError)
      return null
    }

    if (!user?.id) {
      return null
    }

    const { data, error } = await selectUserProfileRecord(
      supabase,
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
