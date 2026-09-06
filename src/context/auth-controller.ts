import type { AppRole, UserProfile } from "@/lib/vendor/supabase/browser"

type SessionUser = {
  id: string
  email?: string | null
}

type AuthResult<T> = {
  data: T | null
  error: string | null
}

type LoadProfileResult = {
  profile: UserProfile | null
  shouldLogout: boolean
}

type BootstrapAuthDeps = {
  getUser: () => Promise<AuthResult<SessionUser>>
  isSessionExpired: () => boolean
  openCurrentSession: () => Promise<AuthResult<void>>
  isServerSessionValid: () => Promise<AuthResult<boolean>>
  logout: () => Promise<unknown>
  loadUserProfile: (sessionUser: SessionUser) => Promise<UserProfile | null>
}

type SignedInAuthDeps = {
  sessionUser: SessionUser | null
  currentUserId: string | null
  currentRole: AppRole | null
  currentProfileId: string | null
  cachedProfile: UserProfile | null
  openCurrentSession: () => Promise<AuthResult<void>>
  markSessionStartIfMissing: () => void
  logout: () => Promise<unknown>
  loadUserProfile: (sessionUser: SessionUser) => Promise<UserProfile | null>
}

export const buildFallbackProfile = (sessionUser: SessionUser): UserProfile => ({
  user: {
    id: sessionUser.id,
    email: sessionUser.email ?? null,
  },
  role: "visitor",
  roleCreatedAt: null,
  roleUpdatedAt: null,
  profile: {
    id: null,
    displayName: null,
    avatarSeed: null,
    avatarVersion: null,
    createdAt: null,
    updatedAt: null,
  },
  system: {
    status: null,
    failedLoginAttempts: null,
    notes: null,
    trusted: null,
    createdAt: null,
    updatedAt: null,
  },
})

export const isHollowAuthProfile = (profile: UserProfile | null | undefined) =>
  Boolean(profile) && !profile?.profile?.id

export async function loadAuthProfile(
  sessionUser: SessionUser,
  getUserProfile: (sessionUser: SessionUser) => Promise<AuthResult<UserProfile>>,
): Promise<UserProfile | null> {
  const { data: profile, error } = await getUserProfile(sessionUser)
  if (error) {
    console.error("Failed to load current user profile:", error)
    return null
  }

  if (!profile || isHollowAuthProfile(profile)) {
    return null
  }

  return profile
}

const rejectIfHollow = async (
  profile: UserProfile | null,
  logout: () => Promise<unknown>,
): Promise<LoadProfileResult> => {
  if (!profile || isHollowAuthProfile(profile)) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  return { profile, shouldLogout: false }
}

export async function bootstrapAuthSession({
  getUser,
  isSessionExpired,
  openCurrentSession,
  isServerSessionValid,
  logout,
  loadUserProfile,
}: BootstrapAuthDeps): Promise<LoadProfileResult> {
  const { data: currentUser } = await getUser()
  if (!currentUser) {
    return { profile: null, shouldLogout: false }
  }

  if (isSessionExpired()) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  const { error: openSessionError } = await openCurrentSession()
  if (openSessionError) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  const { data: isValidServerSession } = await isServerSessionValid()
  if (!isValidServerSession) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  return rejectIfHollow(await loadUserProfile(currentUser), logout)
}

export async function resolveSignedInAuth({
  sessionUser,
  currentUserId,
  currentRole,
  currentProfileId,
  cachedProfile,
  openCurrentSession,
  markSessionStartIfMissing,
  logout,
  loadUserProfile,
}: SignedInAuthDeps): Promise<LoadProfileResult> {
  if (!sessionUser) {
    return { profile: null, shouldLogout: false }
  }

  if (currentUserId === sessionUser.id && currentRole && currentProfileId) {
    return { profile: null, shouldLogout: false }
  }

  if (cachedProfile && !isHollowAuthProfile(cachedProfile)) {
    return { profile: cachedProfile, shouldLogout: false }
  }

  markSessionStartIfMissing()

  const { error: openSessionError } = await openCurrentSession()
  if (openSessionError) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  return rejectIfHollow(await loadUserProfile(sessionUser), logout)
}
