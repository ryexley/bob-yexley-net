import type { SupabaseClient, User } from "@supabase/supabase-js"
import { AUTH_RPC } from "@/lib/vendor/supabase/auth-rpc-names"
import {
  buildUserProfile,
  selectUserProfileRecord,
  type UserProfile,
} from "@/lib/vendor/supabase/user-profile"

export type AuthResult<T = any> = {
  data: T | null
  error: string | null
}

type SessionUser = Pick<User, "id" | "email">

type UserProfileRepositoryDeps = {
  getClient: () => SupabaseClient
  getSessionUser: () => Promise<AuthResult<User>>
}

export function createUserProfileRepository({
  getClient,
  getSessionUser,
}: UserProfileRepositoryDeps) {
  let cachedUserProfile:
    | {
        userId: string
        profile: UserProfile
      }
    | null = null
  const inFlightUserProfiles = new Map<string, Promise<AuthResult<UserProfile>>>()

  const getCachedUserProfile = (userId: string): UserProfile | null => {
    if (cachedUserProfile?.userId !== userId) {
      return null
    }

    return cachedUserProfile.profile
  }

  const setCachedUserProfile = (profile: UserProfile): void => {
    cachedUserProfile = {
      userId: profile.user.id,
      profile,
    }
  }

  const clearCachedUserProfile = (): void => {
    cachedUserProfile = null
  }

  const resolveSessionUser = async (
    sessionUser?: SessionUser | null,
  ): Promise<AuthResult<SessionUser>> => {
    if (sessionUser) {
      return { data: sessionUser, error: null }
    }

    const sessionUserResult = await getSessionUser()
    if (sessionUserResult.error) {
      return { data: null, error: sessionUserResult.error }
    }

    const currentSessionUser = sessionUserResult.data
    if (!currentSessionUser?.id) {
      return { data: null, error: null }
    }

    return {
      data: {
        id: currentSessionUser.id,
        email: currentSessionUser.email ?? null,
      },
      error: null,
    }
  }

  const repository = {
    clearCachedUserProfile,

    peekUserProfile(userId: string | null | undefined): UserProfile | null {
      if (!userId) {
        return null
      }

      return getCachedUserProfile(userId)
    },

    async getUserProfile(
      sessionUser?: SessionUser | null,
    ): Promise<AuthResult<UserProfile>> {
      let resolvedUserId: string | null = sessionUser?.id ?? null

      try {
        const sessionUserResult = await resolveSessionUser(sessionUser)

        if (sessionUserResult.error) {
          return { data: null, error: sessionUserResult.error }
        }

        const currentSessionUser = sessionUserResult.data
        if (!currentSessionUser?.id) {
          return { data: null, error: null }
        }
        resolvedUserId = currentSessionUser.id

        const cachedProfile = getCachedUserProfile(currentSessionUser.id)
        if (cachedProfile) {
          return { data: cachedProfile, error: null }
        }

        const inFlightProfile = inFlightUserProfiles.get(currentSessionUser.id)
        if (inFlightProfile) {
          return await inFlightProfile
        }

        const profilePromise = (async (): Promise<AuthResult<UserProfile>> => {
          const { data, error } = await selectUserProfileRecord(
            getClient(),
            currentSessionUser.id,
          )

          if (error) {
            return { data: null, error }
          }

          if (!data) {
            return { data: null, error: null }
          }

          const profile = buildUserProfile(data, currentSessionUser)
          setCachedUserProfile(profile)

          return {
            data: profile,
            error: null,
          }
        })()

        inFlightUserProfiles.set(currentSessionUser.id, profilePromise)
        return await profilePromise
      } catch (error) {
        console.error("Get user profile error:", error)
        return {
          data: null,
          error: "An unexpected error occurred while fetching user profile",
        }
      } finally {
        if (resolvedUserId) {
          inFlightUserProfiles.delete(resolvedUserId)
        }
      }
    },

    async updateCurrentVisitorDisplayName(
      displayName: string,
      sessionUser?: SessionUser | null,
    ): Promise<AuthResult<UserProfile>> {
      const normalizedDisplayName = displayName?.trim()
      if (!normalizedDisplayName) {
        return { data: null, error: "Display name is required" }
      }

      const sessionUserResult = await resolveSessionUser(sessionUser)
      if (sessionUserResult.error) {
        return { data: null, error: sessionUserResult.error }
      }

      const currentSessionUser = sessionUserResult.data
      if (!currentSessionUser?.id) {
        return { data: null, error: "User not authenticated" }
      }

      try {
        const { error } = await getClient().rpc(AUTH_RPC.updateProfile, {
          next_display_name: normalizedDisplayName,
        })

        if (error) {
          return { data: null, error: error.message }
        }

        clearCachedUserProfile()
        const refreshedProfile = await repository.getUserProfile(currentSessionUser)
        if (refreshedProfile.error) {
          return { data: null, error: refreshedProfile.error }
        }

        if (!refreshedProfile.data) {
          return {
            data: null,
            error: "Updated profile could not be reloaded",
          }
        }

        return refreshedProfile
      } catch (error) {
        console.error("Update current visitor display name error:", error)
        return {
          data: null,
          error: "An unexpected error occurred while updating display name",
        }
      }
    },
  }

  return repository
}
