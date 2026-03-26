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
  isServerSessionValid: () => Promise<AuthResult<boolean>>
  logout: () => Promise<unknown>
  loadUserProfile: (sessionUser: SessionUser) => Promise<UserProfile>
}

type SignedInAuthDeps = {
  sessionUser: SessionUser | null
  currentUserId: string | null
  currentRole: AppRole | null
  cachedProfile: UserProfile | null
  openCurrentSession: () => Promise<AuthResult<void>>
  markSessionStartIfMissing: () => void
  logout: () => Promise<unknown>
  loadUserProfile: (sessionUser: SessionUser) => Promise<UserProfile>
}

export const buildFallbackProfile = (sessionUser: SessionUser): UserProfile => ({
  user: {
    id: sessionUser.id,
    email: sessionUser.email ?? null,
  },
  role: "visitor",
  roleCreatedAt: null,
  roleUpdatedAt: null,
  visitor: {
    id: null,
    displayName: null,
    status: null,
    failedLoginAttempts: null,
    notes: null,
    createdAt: null,
  },
})

export async function loadAuthProfile(
  sessionUser: SessionUser,
  getUserProfile: (sessionUser: SessionUser) => Promise<AuthResult<UserProfile>>,
): Promise<UserProfile> {
  const { data: profile, error } = await getUserProfile(sessionUser)
  if (error) {
    console.error("Failed to load current user profile:", error)
    return buildFallbackProfile(sessionUser)
  }

  return profile ?? buildFallbackProfile(sessionUser)
}

export async function bootstrapAuthSession({
  getUser,
  isSessionExpired,
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

  const { data: isValidServerSession } = await isServerSessionValid()
  if (!isValidServerSession) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  return {
    profile: await loadUserProfile(currentUser),
    shouldLogout: false,
  }
}

export async function resolveSignedInAuth({
  sessionUser,
  currentUserId,
  currentRole,
  cachedProfile,
  openCurrentSession,
  markSessionStartIfMissing,
  logout,
  loadUserProfile,
}: SignedInAuthDeps): Promise<LoadProfileResult> {
  if (!sessionUser) {
    return { profile: null, shouldLogout: false }
  }

  if (currentUserId === sessionUser.id && currentRole) {
    return { profile: null, shouldLogout: false }
  }

  if (cachedProfile) {
    return { profile: cachedProfile, shouldLogout: false }
  }

  markSessionStartIfMissing()

  const { error: openSessionError } = await openCurrentSession()
  if (openSessionError) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  return {
    profile: await loadUserProfile(sessionUser),
    shouldLogout: false,
  }
}
