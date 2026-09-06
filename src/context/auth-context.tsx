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
import { debounce } from "@/util/debounce"
import { TIME } from "@/util/enums"
import { isEmpty, isNotEmpty } from "@/util"

interface AuthContextType {
  profile: () => UserProfile | null
  user: () => UserProfile["user"] | null
  userProfile: () => UserProfile["profile"] | null
  userSystem: () => UserProfile["system"] | null
  role: () => AppRole | null
  loading: () => boolean
  busy: () => boolean
  replaceProfile: (profile: UserProfile | null) => void
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isSuperuser: () => boolean
}

const AuthContext = createContext<AuthContextType>()

const AUTH_RESUME_EVENTS = ["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED"] as const

export function AuthProvider(props: { children: any }) {
  const [profile, setProfile] = createSignal<UserProfile | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [busy, setBusy] = createSignal(true)
  const [initialSnapshotApplied, setInitialSnapshotApplied] = createSignal(false)
  const initialProfile = createAsync(() => getUserProfile())
  const user = createMemo(() => profile()?.user ?? null)
  const userProfile = createMemo(() => profile()?.profile ?? null)
  const userSystem = createMemo(() => profile()?.system ?? null)
  const role = createMemo(() => profile()?.role ?? null)
  let authTransition: Promise<void> = Promise.resolve()

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

  const runAuthTransition = (work: () => Promise<void>) => {
    const run = async () => {
      setBusy(true)
      try {
        await work()
      } finally {
        setBusy(false)
      }
    }

    authTransition = authTransition.then(run, run)
    return authTransition
  }

  const loadSessionProfile = (sessionUser: { id: string; email?: string | null }) =>
    loadAuthProfile(sessionUser, supabase.getUserProfile)

  const applySessionResult = (result: {
    profile: UserProfile | null
    shouldLogout: boolean
  }) => {
    if (result.shouldLogout) {
      clearAuthState()
      return
    }

    if (result.profile) {
      applyAuthProfile(result.profile)
    }
  }

  const healCurrentSession = () =>
    bootstrapAuthSession({
      getUser: supabase.getUser,
      isSessionExpired: () => supabase.isSessionExpired(),
      openCurrentSession: () => supabase.openCurrentSession(),
      isServerSessionValid: () => supabase.isServerSessionValid(),
      logout: () => supabase.logout(),
      loadUserProfile: loadSessionProfile,
    })

  createEffect(() => {
    if (initialSnapshotApplied()) {
      return
    }

    const snapshot = initialProfile()
    if (snapshot === undefined) {
      return
    }

    applyAuthProfile(snapshot ?? null)
    setLoading(false)
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

    await runAuthTransition(async () => {
      const result = await healCurrentSession()
      applySessionResult(result)
      setLoading(false)
    })
  })

  onCleanup(() => {
    setVisitorAuthenticateHandler(undefined)
  })

  createEffect(() => {
    const {
      data: { subscription },
    } = supabase?.client?.auth?.onAuthStateChange((event, session) => {
      void runAuthTransition(async () => {
        if (event === "SIGNED_OUT") {
          supabase.clearSessionStart()
          clearAuthState()
          setLoading(false)
          return
        }

        if (!AUTH_RESUME_EVENTS.includes(event as (typeof AUTH_RESUME_EVENTS)[number])) {
          return
        }

        if (isEmpty(session?.user)) {
          clearAuthState()
          setLoading(false)
          return
        }

        if (event === "TOKEN_REFRESHED") {
          applySessionResult(await healCurrentSession())
          setLoading(false)
          return
        }

        if (isEmpty(userProfile()?.id)) {
          setLoading(true)
        }

        const result = await resolveSignedInAuth({
          sessionUser: session.user,
          currentUserId: user()?.id ?? null,
          currentRole: role(),
          currentProfileId: userProfile()?.id ?? null,
          cachedProfile: supabase.peekUserProfile(session.user.id),
          openCurrentSession: () => supabase.openCurrentSession(),
          markSessionStartIfMissing: () => supabase.markSessionStartIfMissing(),
          logout: () => supabase.logout(),
          loadUserProfile: loadSessionProfile,
        })

        applySessionResult(result)
        setLoading(false)
      })
    })

    return () => subscription?.unsubscribe()
  })

  onMount(() => {
    const revalidateVisibleSession = debounce(() => {
      if (document.visibilityState !== "visible") {
        return
      }

      if (!user()?.id) {
        return
      }

      void runAuthTransition(async () => {
        applySessionResult(await healCurrentSession())
      })
    }, TIME.ONE_SECOND)

    const handleVisibility = () => {
      revalidateVisibleSession()
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleVisibility)

    onCleanup(() => {
      revalidateVisibleSession.cancel()
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleVisibility)
    })
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
    busy,
    replaceProfile: applyAuthProfile,
    logout,
    isAuthenticated: () => isNotEmpty(user()) && isNotEmpty(userProfile()?.id),
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
