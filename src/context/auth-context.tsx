import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js"
import { createAsync } from "@solidjs/router"
import { supabase, type AppRole, type UserProfile } from "@/lib/vendor/supabase/browser"
import {
  bootstrapAuthSession,
  loadAuthProfile,
  resolveSignedInAuth,
} from "@/context/auth-controller"
import { setVisitorAuthenticateHandler } from "@/modules/auth/components/visitor-auth-modal"
import { getUserProfile } from "@/modules/auth/data/queries"
import { isEmpty, isNotEmpty } from "@/util"

interface AuthContextType {
  profile: () => UserProfile | null
  user: () => UserProfile["user"] | null
  userProfile: () => UserProfile["profile"] | null
  userSystem: () => UserProfile["system"] | null
  role: () => AppRole | null
  loading: () => boolean
  replaceProfile: (profile: UserProfile | null) => void
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isSuperuser: () => boolean
}

const AuthContext = createContext<AuthContextType>()

export function AuthProvider(props: { children: any }) {
  const [profile, setProfile] = createSignal<UserProfile | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [bootstrapped, setBootstrapped] = createSignal(false)
  const [initialSnapshotApplied, setInitialSnapshotApplied] = createSignal(false)
  const initialProfile = createAsync(() => getUserProfile())
  const user = createMemo(() => profile()?.user ?? null)
  const userProfile = createMemo(() => profile()?.profile ?? null)
  const userSystem = createMemo(() => profile()?.system ?? null)
  const role = createMemo(() => profile()?.role ?? null)

  const clearAuthState = () => {
    setProfile(null)
  }

  const applyAuthProfile = (profile: UserProfile | null) => {
    if (isEmpty(profile)) {
      clearAuthState()
      return
    }

    setProfile(profile)
  }

  createEffect(() => {
    if (initialSnapshotApplied()) {
      return
    }

    const profile = initialProfile()
    if (profile === undefined) {
      return
    }

    applyAuthProfile(profile ?? null)
    setLoading(false)
    setBootstrapped(true)
    setInitialSnapshotApplied(true)
  })

  onMount(async () => {
    setVisitorAuthenticateHandler(async credentials => {
      if (credentials.mode === "signup") {
        const { error } = await supabase.visitorSignUp(
          credentials.email,
          credentials.pin,
          credentials.displayName,
        )
        return {
          success: isEmpty(error),
          error: error ?? undefined,
        }
      }

      const { error } = await supabase.visitorLogin(credentials.email, credentials.pin)
      return {
        success: isEmpty(error),
        error: error ?? undefined,
      }
    })

    await Promise.resolve()
    if (bootstrapped()) {
      return
    }

    const { profile: nextProfile } = await bootstrapAuthSession({
      getUser: supabase.getUser,
      isSessionExpired: () => supabase.isSessionExpired(),
      isServerSessionValid: () => supabase.isServerSessionValid(),
      logout: () => supabase.logout(),
      loadUserProfile: sessionUser =>
        loadAuthProfile(sessionUser, supabase.getUserProfile),
    })
    if (bootstrapped()) {
      return
    }

    applyAuthProfile(nextProfile)

    setLoading(false)
    setBootstrapped(true)
  })

  onCleanup(() => {
    setVisitorAuthenticateHandler(undefined)
  })

  createEffect(() => {
    const {
      data: { subscription },
    } = supabase?.client?.auth?.onAuthStateChange((event, session) => {
      void (async () => {
        if (event === "SIGNED_OUT") {
          supabase.clearSessionStart()
          clearAuthState()
          setLoading(false)
          return
        }

        if (!bootstrapped() || event !== "SIGNED_IN") {
          return
        }

        if (isEmpty(session?.user)) {
          clearAuthState()
          setLoading(false)
          return
        }

        setLoading(true)
        const { profile: nextProfile, shouldLogout } = await resolveSignedInAuth({
          sessionUser: session.user,
          currentUserId: user()?.id ?? null,
          currentRole: role(),
          cachedProfile: supabase.peekUserProfile(session.user.id),
          openCurrentSession: () => supabase.openCurrentSession(),
          markSessionStartIfMissing: () => supabase.markSessionStartIfMissing(),
          logout: () => supabase.logout(),
          loadUserProfile: sessionUser =>
            loadAuthProfile(sessionUser, supabase.getUserProfile),
        })

        if (shouldLogout) {
          clearAuthState()
          setLoading(false)
          return
        }

        if (nextProfile) {
          applyAuthProfile(nextProfile)
        }

        setLoading(false)
      })()
    })

    return () => subscription?.unsubscribe()
  })

  const logout = async () => {
    await supabase?.logout()
    clearAuthState()
  }

  const context = {
    profile,
    user,
    userProfile,
    userSystem,
    role,
    loading,
    replaceProfile: applyAuthProfile,
    logout,
    isAuthenticated: () => isNotEmpty(user()),
    isAdmin: () => role() === "admin" || role() === "superuser",
    isSuperuser: () => role() === "superuser",
  }

  return (
    <AuthContext.Provider value={context}>
      {props.children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (isEmpty(context)) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
