import {
  createClient,
  type SupabaseClient,
  type User,
  type AuthError,
} from "@supabase/supabase-js"
import { createBrowserClient } from "@supabase/ssr"
import { isServer } from "solid-js/web"
import { isEmpty } from "@/util"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables")
}

const SESSION_STARTED_AT_STORAGE_KEY = "auth:session-started-at"
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_SESSION_TTL = "7 days"

// Singleton client instance
let browserClient: SupabaseClient | null = null

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage
}

function getSessionStartedAtMs() {
  if (!canUseStorage()) {
    return null
  }

  const raw = window.localStorage.getItem(SESSION_STARTED_AT_STORAGE_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function setSessionStartedAtMs(timestampMs: number) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(
    SESSION_STARTED_AT_STORAGE_KEY,
    String(timestampMs),
  )
}

function clearSessionStartedAtMs() {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(SESSION_STARTED_AT_STORAGE_KEY)
}

export function getClient(): SupabaseClient {
  if (isServer) {
    // Server fallback client without request auth context.
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  } else {
    if (isEmpty(browserClient)) {
      browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    }

    return browserClient
  }
}

export type AuthResult<T = any> = {
  data: T | null
  error: string | null
}

export type AppRole = "superuser" | "admin" | "visitor"

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
    async openCurrentSession(
      ttl: string = DEFAULT_SESSION_TTL,
    ): Promise<AuthResult<void>> {
      try {
        const { error } = await getClient().rpc("open_current_session", { ttl })

        if (error) {
          return { data: null, error: error.message }
        }

        return { data: null, error: null }
      } catch (err) {
        console.error("Open current session error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while opening session",
        }
      }
    },

    async revokeCurrentSession(): Promise<AuthResult<void>> {
      try {
        const { error } = await getClient().rpc("revoke_current_session")

        if (error) {
          return { data: null, error: error.message }
        }

        return { data: null, error: null }
      } catch (err) {
        console.error("Revoke current session error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while revoking session",
        }
      }
    },

    async isServerSessionValid(
      maxAge: string = DEFAULT_SESSION_TTL,
    ): Promise<AuthResult<boolean>> {
      try {
        const { data, error } = await getClient().rpc("session_is_valid", {
          max_age: maxAge,
        })

        if (error) {
          return { data: null, error: error.message }
        }

        return { data: data === true, error: null }
      } catch (err) {
        console.error("Server session validity check error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while validating session",
        }
      }
    },

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

        setSessionStartedAtMs(Date.now())

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
        await this.revokeCurrentSession()

        const { error } = await getClient()?.auth?.signOut()

        if (error) {
          return { data: null, error: formatAuthError(error) }
        }

        clearSessionStartedAtMs()

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

    async getCurrentUserRole(userId?: string): Promise<AuthResult<AppRole>> {
      try {
        let targetUserId = userId
        if (!targetUserId) {
          const { data: authData, error: authError } =
            await getClient().auth.getUser()

          if (authError) {
            return { data: null, error: formatAuthError(authError) }
          }

          targetUserId = authData?.user?.id
        }

        if (!targetUserId) {
          return { data: null, error: "No user ID provided" }
        }

        const { data, error } = await getClient()
          .from("user_roles")
          .select("role")
          .eq("user_id", targetUserId)
          .maybeSingle()

        if (error) {
          return { data: null, error: error.message }
        }

        const role = data?.role as AppRole | undefined
        if (!role) {
          return { data: "visitor", error: null }
        }

        return { data: role, error: null }
      } catch (err) {
        console.error("Get current user role error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while fetching user role",
        }
      }
    },

    getSessionAgeMs(): number | null {
      const sessionStartedAtMs = getSessionStartedAtMs()
      if (isEmpty(sessionStartedAtMs)) {
        return null
      }

      return Date.now() - sessionStartedAtMs
    },

    hasSessionStartedAt(): boolean {
      return !isEmpty(getSessionStartedAtMs())
    },

    markSessionStartIfMissing(): void {
      if (!this.hasSessionStartedAt()) {
        setSessionStartedAtMs(Date.now())
      }
    },

    clearSessionStart(): void {
      clearSessionStartedAtMs()
    },

    isSessionExpired(maxSessionAgeMs: number = ONE_WEEK_MS): boolean {
      const ageMs = this.getSessionAgeMs()

      // Missing timestamp is treated as expired to enforce strict max age.
      if (isEmpty(ageMs)) {
        return true
      }

      return ageMs > maxSessionAgeMs
    },

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
