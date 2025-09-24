import {
  createContext,
  createEffect,
  createSignal,
  onMount,
  useContext,
} from "solid-js"
import { supabase } from "@/lib/vendor/supabase"
import { isEmpty, isNotEmpty } from "@/util"

const AuthContext = createContext()

export function AuthProvider(props: { children: any }) {
  const [user, setUser] = createSignal(null)
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    const { data: currentUser } = await supabase?.getUser()

    if (isNotEmpty(currentUser)) {
      setUser(currentUser)
    }

    setLoading(false)
  })

  createEffect(() => {
    const {
      data: { subscription },
    } = supabase?.client?.auth?.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
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
