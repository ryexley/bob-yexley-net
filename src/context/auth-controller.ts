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
  markSessionStartIfMissing: () => void
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

/**
 * Nothing was learned, so the caller keeps whatever it already had. Distinct
 * from `shouldLogout: true`, which revokes the server session row and signs the
 * user out of Supabase — an unrecoverable step that must only follow a real
 * answer from the server, never a request that failed to arrive.
 */
const unverified = (): LoadProfileResult => ({
  profile: null,
  shouldLogout: false,
})

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

/**
 * Revalidates the current session. This runs on mount, on every token refresh,
 * and every time the tab regains focus — so on a phone it runs constantly, and
 * anything it treats as grounds for signing out will eventually happen at the
 * worst moment. Only a definitive answer from the server ends a session here.
 */
export async function bootstrapAuthSession({
  getUser,
  isSessionExpired,
  markSessionStartIfMissing,
  openCurrentSession,
  isServerSessionValid,
  logout,
  loadUserProfile,
}: BootstrapAuthDeps): Promise<LoadProfileResult> {
  const { data: currentUser } = await getUser()
  if (!currentUser) {
    return unverified()
  }

  // The auth cookie is what proves a session exists; this timestamp is only the
  // client's note of when it began. Safari evicts localStorage on its own, and
  // an absent stamp reads as expired, so losing it used to sign the user out of
  // a perfectly good session. Adopt the session instead and let the check below
  // enforce the real age limit against `user_sessions.started_at`, which lives
  // in Postgres and cannot be evicted.
  markSessionStartIfMissing()

  if (isSessionExpired()) {
    await logout()
    return { profile: null, shouldLogout: true }
  }

  // Everything past here asks the server a question, and a question that never
  // arrived is not a "no". Failing to reach Postgres says nothing about whether
  // the session is good, so the session survives and the next focus retries.
  const { error: openSessionError } = await openCurrentSession()
  if (openSessionError) {
    return unverified()
  }

  // Only worth asking because the session row was just written. Skipping this
  // when the write failed matters: `session_is_valid` would answer a truthful
  // `false` for a row that does not exist yet, and that false would be read as
  // a revoked session and sign the user out.
  const { data: isValidServerSession, error: validationError } =
    await isServerSessionValid()
  if (validationError) {
    return unverified()
  }

  if (!isValidServerSession) {
    // The server answered, and the answer was no: revoked from another device,
    // or past its expiry. This is the one path that should end a session.
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
    return unverified()
  }

  if (currentUserId === sessionUser.id && currentRole && currentProfileId) {
    return unverified()
  }

  if (cachedProfile && !isHollowAuthProfile(cachedProfile)) {
    return { profile: cachedProfile, shouldLogout: false }
  }

  markSessionStartIfMissing()

  // Unreachable is not unauthorized, same as in `bootstrapAuthSession`. This
  // path runs on every `INITIAL_SESSION`, so a cold start on a bad connection
  // used to sign out a returning user before they could do anything.
  const { error: openSessionError } = await openCurrentSession()
  if (openSessionError) {
    return unverified()
  }

  return rejectIfHollow(await loadUserProfile(sessionUser), logout)
}
