import {
  createContext,
  createEffect,
  createSignal,
  onMount,
  useContext,
} from "solid-js"
import { supabase } from "@/lib/vendor/supabase"
import { isEmpty, isNotEmpty } from "@/util"

interface AuthContextType {
  user: () => any | null
  loading: () => boolean
  logout: () => Promise<void>
  isAuthenticated: () => boolean
}

const AuthContext = createContext<AuthContextType>()

export function AuthProvider(props: { children: any }) {
  const [user, setUser] = createSignal(null)
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    const { data: currentUser } = await supabase?.getUser()

    if (isNotEmpty(currentUser)) {
      if (supabase.isSessionExpired()) {
        await supabase.logout()
        setUser(null)
        setLoading(false)
        return
      }

      const { data: isValidServerSession } = await supabase.isServerSessionValid()
      if (!isValidServerSession) {
        await supabase.logout()
        setUser(null)
        setLoading(false)
        return
      }

      setUser(currentUser)
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
          setLoading(false)
          return
        }

        if (isEmpty(session?.user)) {
          setUser(null)
          setLoading(false)
          return
        }

        if (event === "SIGNED_IN") {
          supabase.markSessionStartIfMissing()

          const { error: openSessionError } = await supabase.openCurrentSession()
          if (isNotEmpty(openSessionError)) {
            await supabase.logout()
            setUser(null)
            setLoading(false)
            return
          }
        }

        if (supabase.isSessionExpired()) {
          await supabase.logout()
          setUser(null)
          setLoading(false)
          return
        }

        const { data: isValidServerSession } = await supabase.isServerSessionValid()
        if (!isValidServerSession) {
          await supabase.logout()
          setUser(null)
          setLoading(false)
          return
        }

        setUser(session?.user ?? null)
        setLoading(false)
      })()
    })

    return () => subscription?.unsubscribe()
  })

  const logout = async () => {
    await supabase?.logout()
    setUser(null)
  }

  const context = {
    user,
    loading,
    logout,
    isAuthenticated: () => isNotEmpty(user()),
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
