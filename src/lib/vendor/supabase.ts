import {
  createClient,
  type SupabaseClient,
  type User,
  type AuthError,
} from "@supabase/supabase-js"

// Validate environment variables at module load time
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables")
}

// Singleton client instance
let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as SupabaseClient
  }

  return client
}

export type AuthResult<T = any> = {
  data: T | null
  error: string | null
}

function formatAuthError(error: AuthError): string {
  const errorMessages: Record<string, string> = {
    "Invalid login credentials": "Invalid email or password",
    "Email not confirmed": "Please check your email and confirm your account",
    "Too many requests": "Too many login attempts. Please try again later",
    "User not found": "No account found with this email address",
  }

  return (
    errorMessages[error.message] ||
    error.message ||
    "An authentication error occurred"
  )
}

function Supabase() {
  return {
    async login(email: string, password: string): Promise<AuthResult<User>> {
      try {
        if (!email?.trim() || !password?.trim()) {
          return { data: null, error: "Email and password are required" }
        }

        const { data, error } = await getClient().auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          return { data: null, error: formatAuthError(error) }
        }

        return { data: data?.user, error: null }
      } catch (err) {
        console.error("Login error:", err)
        return {
          data: null,
          error: "An unexpected error occurred during login",
        }
      }
    },

    async logout(): Promise<AuthResult<void>> {
      try {
        const { error } = await getClient()?.auth?.signOut()

        if (error) {
          return { data: null, error: formatAuthError(error) }
        }

        return { data: null, error: null }
      } catch (err) {
        console.error("Logout error:", err)
        return {
          data: null,
          error: "An unexpected error occurred during logout",
        }
      }
    },

    async getUser(): Promise<AuthResult<User>> {
      try {
        const { data, error } = await getClient()?.auth?.getUser()

        if (error) {
          return { data: null, error: formatAuthError(error) }
        }

        return { data: data?.user, error: null }
      } catch (err) {
        console.error("Get user error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while fetching user",
        }
      }
    },

    // eslint-disable-next-line no-unused-vars
    onAuthStateChange(callback: (user: User | null) => void) {
      return getClient()?.auth?.onAuthStateChange((event, session) => {
        callback(session?.user ?? null)
      })
    },

    get client() {
      return getClient()
    },
  }
}

// Export singleton instance
export const supabase = Supabase()
