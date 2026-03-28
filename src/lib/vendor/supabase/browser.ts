/**
 * Browser-facing Supabase module.
 *
 * Trust boundary:
 * - Safe for browser/runtime usage.
 * - Uses anon key and user session auth flows.
 * - Must not use service-role credentials.
 *
 * Use this module for:
 * - interactive auth/login/logout/session checks
 * - user-scoped reads/writes governed by RLS
 */
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

// Singleton browser client instance
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

export const getBrowserClient = getClient

export type AuthResult<T = any> = {
  data: T | null
  error: string | null
}

export type AppRole = "superuser" | "admin" | "visitor"

type VisitorStatus = "pending" | "active" | "locked"

type FailedVisitorLoginAttemptResult = {
  found: boolean
  locked: boolean
  failed_attempts: number
}

const VISITOR_MAX_FAILED_LOGIN_ATTEMPTS = 5
const VISITOR_LOCKED_MESSAGE =
  "Something's not working right now. Text or call or contact me somehow, and we'll get it sorted out."

const emitVisitorAuthTelemetry = (
  event: "signup" | "login",
  outcome: "success" | "failure",
  email: string,
  reason?: string,
) => {
  if (isServer || typeof fetch !== "function") {
    return
  }

  void fetch("/api/auth/visitor/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      event,
      outcome,
      email,
      reason,
    }),
    keepalive: true,
  }).catch(() => {})
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

    async visitorLogin(email: string, pin: string): Promise<AuthResult<User>> {
      try {
        const client = getClient()
        const normalizedEmail = email?.trim().toLowerCase()
        if (!normalizedEmail || !pin?.trim()) {
          emitVisitorAuthTelemetry(
            "login",
            "failure",
            normalizedEmail || email,
            "validation",
          )
          return { data: null, error: "Email and PIN are required" }
        }

        const { data, error } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password: pin,
        })

        if (error) {
          if (error.message === "Invalid login credentials") {
            const failedAttempt =
              await this.recordFailedVisitorLoginAttempt(normalizedEmail)
            if (failedAttempt.locked) {
              emitVisitorAuthTelemetry(
                "login",
                "failure",
                normalizedEmail,
                "locked",
              )
              return { data: null, error: VISITOR_LOCKED_MESSAGE }
            }
            emitVisitorAuthTelemetry(
              "login",
              "failure",
              normalizedEmail,
              "invalid_credentials",
            )
            return {
              data: null,
              error: "Invalid email or PIN. Please try again.",
            }
          }
          emitVisitorAuthTelemetry(
            "login",
            "failure",
            normalizedEmail,
            error.message,
          )
          return { data: null, error: formatAuthError(error) }
        }

        const signedInUser = data?.user
        if (!signedInUser) {
          return { data: null, error: "Unable to authenticate" }
        }

        const { data: visitorStatus, error: statusError } =
          await this.getCurrentVisitorStatus()
        if (statusError) {
          await client.auth.signOut()
          emitVisitorAuthTelemetry(
            "login",
            "failure",
            normalizedEmail,
            "status_lookup_failed",
          )
          return { data: null, error: statusError }
        }

        if (visitorStatus === "locked") {
          await client.auth.signOut()
          emitVisitorAuthTelemetry(
            "login",
            "failure",
            normalizedEmail,
            "locked",
          )
          return { data: null, error: VISITOR_LOCKED_MESSAGE }
        }

        const { error: resetError } =
          await this.resetCurrentVisitorFailedLoginAttempts()
        if (resetError) {
          console.error(
            "Failed to reset visitor failed login attempts:",
            resetError,
          )
        }

        setSessionStartedAtMs(Date.now())
        emitVisitorAuthTelemetry("login", "success", normalizedEmail)

        return { data: signedInUser, error: null }
      } catch (err) {
        console.error("Visitor login error:", err)
        emitVisitorAuthTelemetry("login", "failure", email, "exception")
        return {
          data: null,
          error: "An unexpected error occurred during login",
        }
      }
    },

    async visitorSignUp(
      email: string,
      pin: string,
      displayName: string,
    ): Promise<AuthResult<User>> {
      try {
        const client = getClient()
        if (isServer) {
          return {
            data: null,
            error: "Visitor sign-up must run in the browser.",
          }
        }

        const normalizedEmail = email?.trim().toLowerCase()
        const normalizedDisplayName = displayName?.trim()

        if (!normalizedEmail || !pin?.trim() || !normalizedDisplayName) {
          emitVisitorAuthTelemetry(
            "signup",
            "failure",
            normalizedEmail || email,
            "validation",
          )
          return {
            data: null,
            error: "Email, PIN, and display name are required",
          }
        }

        const signupResponse = await fetch("/api/auth/visitor/signup", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            pin,
            displayName: normalizedDisplayName,
          }),
        })

        const signupResult = await signupResponse
          .json()
          .catch(() => ({
            success: false,
            error: "Unable to create visitor account.",
          }))

        if (!signupResponse.ok || signupResult?.success !== true) {
          emitVisitorAuthTelemetry(
            "signup",
            "failure",
            normalizedEmail,
            signupResult?.error || "signup_endpoint_failed",
          )
          return {
            data: null,
            error: signupResult?.error || "Unable to create visitor account.",
          }
        }

        const { data: signInData, error: signInError } =
          await client.auth.signInWithPassword({
            email: normalizedEmail,
            password: pin,
          })

        if (signInError) {
          emitVisitorAuthTelemetry(
            "signup",
            "failure",
            normalizedEmail,
            signInError.message,
          )
          return { data: null, error: formatAuthError(signInError) }
        }

        const signedInUser = signInData?.user
        if (!signedInUser) {
          return { data: null, error: "Unable to create visitor account" }
        }

        setSessionStartedAtMs(Date.now())
        emitVisitorAuthTelemetry("signup", "success", normalizedEmail)

        return { data: signedInUser, error: null }
      } catch (err) {
        console.error("Visitor sign-up error:", err)
        emitVisitorAuthTelemetry("signup", "failure", email, "exception")
        return {
          data: null,
          error: "An unexpected error occurred during sign-up",
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

    async recordFailedVisitorLoginAttempt(
      targetEmail: string,
      maxAttempts: number = VISITOR_MAX_FAILED_LOGIN_ATTEMPTS,
    ): Promise<FailedVisitorLoginAttemptResult> {
      const normalizedEmail = targetEmail?.trim().toLowerCase()
      if (!normalizedEmail) {
        return { found: false, locked: false, failed_attempts: 0 }
      }

      try {
        const client = getClient()
        const { data, error } = await client.rpc(
          "record_failed_visitor_login_attempt",
          {
            target_email: normalizedEmail,
            max_attempts: maxAttempts,
          },
        )

        if (error) {
          console.error("Failed to record visitor login attempt:", error)
          return { found: false, locked: false, failed_attempts: 0 }
        }

        return {
          found: data?.found === true,
          locked: data?.locked === true,
          failed_attempts:
            typeof data?.failed_attempts === "number"
              ? data.failed_attempts
              : 0,
        }
      } catch (err) {
        console.error("recordFailedVisitorLoginAttempt error:", err)
        return { found: false, locked: false, failed_attempts: 0 }
      }
    },

    async resetCurrentVisitorFailedLoginAttempts(): Promise<AuthResult<void>> {
      try {
        const client = getClient()
        const { error } = await client.rpc(
          "reset_current_visitor_failed_login_attempts",
        )
        if (error) {
          return { data: null, error: error.message }
        }

        return { data: null, error: null }
      } catch (err) {
        console.error("resetCurrentVisitorFailedLoginAttempts error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while resetting login attempts",
        }
      }
    },

    async getCurrentVisitorStatus(): Promise<AuthResult<VisitorStatus>> {
      try {
        const client = getClient()
        const { data: authData, error: authError } = await client.auth.getUser()
        if (authError) {
          return { data: null, error: formatAuthError(authError) }
        }

        const currentUserId = authData?.user?.id
        if (!currentUserId) {
          return { data: null, error: "No authenticated visitor session found" }
        }

        const { data, error } = await client
          .from("visitors")
          .select("status")
          .eq("user_id", currentUserId)
          .maybeSingle()

        if (error) {
          return { data: null, error: error.message }
        }

        if (!data?.status) {
          return { data: null, error: "Visitor profile not found" }
        }

        return { data: data.status as VisitorStatus, error: null }
      } catch (err) {
        console.error("getCurrentVisitorStatus error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while loading visitor status",
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
