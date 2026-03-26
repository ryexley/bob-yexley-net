import {
  createContext,
  createEffect,
  createSignal,
  onMount,
  useContext,
} from "solid-js"
import { supabase, type AppRole } from "@/lib/vendor/supabase"
import { isEmpty, isNotEmpty } from "@/util"

interface AuthContextType {
  user: () => any | null
  role: () => AppRole | null
  loading: () => boolean
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isSuperuser: () => boolean
}

const AuthContext = createContext<AuthContextType>()

export function AuthProvider(props: { children: any }) {
  const [user, setUser] = createSignal(null)
  const [role, setRole] = createSignal<AppRole | null>(null)
  const [loading, setLoading] = createSignal(true)

  const syncRoleForUser = async (userId: string) => {
    const { data: userRole, error: roleError } =
      await supabase.getCurrentUserRole(userId)

    if (isNotEmpty(roleError)) {
      console.error("Failed to load user role:", roleError)
      setRole("visitor")
      return
    }

    setRole(userRole ?? "visitor")
  }

  onMount(async () => {
    const { data: currentUser } = await supabase?.getUser()

    if (isNotEmpty(currentUser)) {
      if (supabase.isSessionExpired()) {
        await supabase.logout()
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }

      const { data: isValidServerSession } = await supabase.isServerSessionValid()
      if (!isValidServerSession) {
        await supabase.logout()
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }

      setUser(currentUser)
      await syncRoleForUser(currentUser.id)
    }

    setLoading(false)
  })

  createEffect(() => {
    const {
      data: { subscription },
    } = supabase?.client?.auth?.onAuthStateChange((event, session) => {
      void (async () => {
        if (event === "SIGNED_OUT") {
          supabase.clearSessionStart()
          setUser(null)
          setRole(null)
          setLoading(false)
          return
        }

        if (isEmpty(session?.user)) {
          setUser(null)
          setRole(null)
          setLoading(false)
          return
        }

        if (event === "SIGNED_IN") {
          supabase.markSessionStartIfMissing()

          const { error: openSessionError } = await supabase.openCurrentSession()
          if (isNotEmpty(openSessionError)) {
            await supabase.logout()
            setUser(null)
            setRole(null)
            setLoading(false)
            return
          }
        }

        if (supabase.isSessionExpired()) {
          await supabase.logout()
          setUser(null)
          setRole(null)
          setLoading(false)
          return
        }

        const { data: isValidServerSession } = await supabase.isServerSessionValid()
        if (!isValidServerSession) {
          await supabase.logout()
          setUser(null)
          setRole(null)
          setLoading(false)
          return
        }

        const nextUser = session?.user ?? null
        setUser(nextUser)
        if (isNotEmpty(nextUser)) {
          await syncRoleForUser(nextUser.id)
        } else {
          setRole(null)
        }
        setLoading(false)
      })()
    })

    return () => subscription?.unsubscribe()
  })

  const logout = async () => {
    await supabase?.logout()
    setUser(null)
    setRole(null)
  }

  const context = {
    user,
    role,
    loading,
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
