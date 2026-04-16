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
  type User,
  type AuthError,
} from "@supabase/supabase-js"
import { createBrowserClient } from "@supabase/ssr"
import { isServer } from "solid-js/web"
import type { AppSupabaseClient, Database } from "@/lib/vendor/supabase/types"
import {
  type AppRole,
  type UserProfile,
  type UserStatus,
  type VisitorStatus,
} from "@/lib/vendor/supabase/user-profile"
import {
  clearSessionStartedAtMs,
  getSessionAgeMs,
  hasSessionStartedAt,
  isSessionExpired,
  markSessionStartIfMissing,
  setSessionStartedAtMs,
} from "@/lib/vendor/supabase/session-state"
import {
  createSessionRpcService,
  type AuthResult,
} from "@/lib/vendor/supabase/session-rpc-service"
import { createUserProfileRepository } from "@/lib/vendor/supabase/user-profile-repository"
import {
  VISITOR_AUTH_ERROR,
  isVisitorAuthErrorCode,
} from "@/lib/auth/visitor-auth-errors"
import { resolveBrowserSupabaseUrl } from "@/lib/vendor/supabase/browser-url"
import { isEmpty } from "@/util"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables")
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_SESSION_TTL = "7 days"

// Singleton browser client instance
let browserClient: AppSupabaseClient | null = null

export function getClient(): AppSupabaseClient {
  if (isServer) {
    // Server fallback client without request auth context.
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  } else {
    if (isEmpty(browserClient)) {
      browserClient = createBrowserClient<Database>(
        resolveBrowserSupabaseUrl(
          SUPABASE_URL,
          typeof window === "undefined" ? null : window.location.hostname,
        ),
        SUPABASE_ANON_KEY,
      )
    }

    return browserClient
  }
}

export const getBrowserClient = getClient

type FailedVisitorLoginAttemptResult = {
  found: boolean
  locked: boolean
  failed_attempts: number
}

const VISITOR_MAX_FAILED_LOGIN_ATTEMPTS = 5

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

async function getSessionUser(): Promise<AuthResult<User>> {
  try {
    const { data, error } = await getClient().auth.getSession()
    if (error) {
      return { data: null, error: formatAuthError(error) }
    }

    return { data: data.session?.user ?? null, error: null }
  } catch (err) {
    console.error("Get session user error:", err)
    return {
      data: null,
      error: "An unexpected error occurred while fetching session user",
    }
  }
}

const sessionRpc = createSessionRpcService({ getClient })
const userProfiles = createUserProfileRepository({
  getClient,
  getSessionUser,
})

function Supabase() {
  return {
    async openCurrentSession(
      ttl: string = DEFAULT_SESSION_TTL,
    ): Promise<AuthResult<void>> {
      return sessionRpc.openCurrentSession(ttl)
    },

    async revokeCurrentSession(): Promise<AuthResult<void>> {
      return sessionRpc.revokeCurrentSession()
    },

    async isServerSessionValid(
      maxAge: string = DEFAULT_SESSION_TTL,
    ): Promise<AuthResult<boolean>> {
      return sessionRpc.isServerSessionValid(maxAge)
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
          return { data: null, error: VISITOR_AUTH_ERROR.VALIDATION_LOGIN_REQUIRED }
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
              return { data: null, error: VISITOR_AUTH_ERROR.VISITOR_LOCKED }
            }
            emitVisitorAuthTelemetry(
              "login",
              "failure",
              normalizedEmail,
              "invalid_credentials",
            )
            return {
              data: null,
              error: VISITOR_AUTH_ERROR.INVALID_EMAIL_OR_PIN,
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
          return { data: null, error: VISITOR_AUTH_ERROR.UNEXPECTED }
        }

        this.markSessionStartIfMissing()
        const { error: openSessionError } = await this.openCurrentSession()
        if (openSessionError) {
          await client.auth.signOut()
          userProfiles.clearCachedUserProfile()
          emitVisitorAuthTelemetry(
            "login",
            "failure",
            normalizedEmail,
            "open_session_failed",
          )
          return { data: null, error: VISITOR_AUTH_ERROR.UNEXPECTED }
        }

        const { data: profile, error: profileError } =
          await this.getUserProfile(signedInUser)
        const userStatus = profile?.system.status ?? null
        const statusError = profileError ?? (!userStatus ? "User profile not found" : null)
        if (statusError) {
          await client.auth.signOut()
          userProfiles.clearCachedUserProfile()
          emitVisitorAuthTelemetry(
            "login",
            "failure",
            normalizedEmail,
            "status_lookup_failed",
          )
          return { data: null, error: VISITOR_AUTH_ERROR.UNEXPECTED }
        }

        if (userStatus === "locked") {
          await client.auth.signOut()
          userProfiles.clearCachedUserProfile()
          emitVisitorAuthTelemetry(
            "login",
            "failure",
            normalizedEmail,
            "locked",
          )
          return { data: null, error: VISITOR_AUTH_ERROR.VISITOR_LOCKED }
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
          error: VISITOR_AUTH_ERROR.UNEXPECTED,
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
            error: VISITOR_AUTH_ERROR.SIGNUP_UNAVAILABLE,
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
            error: VISITOR_AUTH_ERROR.VALIDATION_SIGNUP_REQUIRED,
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
            error: VISITOR_AUTH_ERROR.SIGNUP_UNAVAILABLE,
          }))

        if (!signupResponse.ok || signupResult?.success !== true) {
          const signupErrorCode = isVisitorAuthErrorCode(signupResult?.error)
            ? signupResult.error
            : VISITOR_AUTH_ERROR.SIGNUP_UNAVAILABLE
          emitVisitorAuthTelemetry(
            "signup",
            "failure",
            normalizedEmail,
            signupErrorCode,
          )
          return {
            data: null,
            error: signupErrorCode,
          }
        }

        const { data: signInData, error: signInError } =
          await client.auth.signInWithPassword({
            email: normalizedEmail,
            password: pin,
          })

        if (signInError) {
          const signInErrorCode =
            signInError.message === "Invalid login credentials"
              ? VISITOR_AUTH_ERROR.INVALID_EMAIL_OR_PIN
              : VISITOR_AUTH_ERROR.UNEXPECTED
          emitVisitorAuthTelemetry(
            "signup",
            "failure",
            normalizedEmail,
            signInErrorCode,
          )
          return { data: null, error: signInErrorCode }
        }

        const signedInUser = signInData?.user
        if (!signedInUser) {
          return { data: null, error: VISITOR_AUTH_ERROR.UNEXPECTED }
        }

        setSessionStartedAtMs(Date.now())
        emitVisitorAuthTelemetry("signup", "success", normalizedEmail)

        return { data: signedInUser, error: null }
      } catch (err) {
        console.error("Visitor sign-up error:", err)
        emitVisitorAuthTelemetry("signup", "failure", email, "exception")
        return {
          data: null,
          error: VISITOR_AUTH_ERROR.UNEXPECTED,
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
        userProfiles.clearCachedUserProfile()

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
      return sessionRpc.recordFailedVisitorLoginAttempt(targetEmail, maxAttempts)
    },

    async resetCurrentVisitorFailedLoginAttempts(): Promise<AuthResult<void>> {
      return sessionRpc.resetCurrentVisitorFailedLoginAttempts()
    },

    async getCurrentUserStatus(): Promise<AuthResult<UserStatus>> {
      try {
        const { data: profile, error } = await this.getUserProfile()
        if (error) {
          return { data: null, error }
        }

        if (!profile?.system.status) {
          return { data: null, error: "User profile not found" }
        }

        return { data: profile.system.status, error: null }
      } catch (err) {
        console.error("getCurrentUserStatus error:", err)
        return {
          data: null,
          error: "An unexpected error occurred while loading user status",
        }
      }
    },

    async getUser(): Promise<AuthResult<User>> {
      const { data, error } = await getSessionUser()
      if (error) {
        return { data: null, error }
      }

      return { data, error: null }
    },

    async getUserProfile(
      sessionUser?: Pick<User, "id" | "email"> | null,
    ): Promise<AuthResult<UserProfile>> {
      return userProfiles.getUserProfile(sessionUser)
    },

    async updateCurrentUserDisplayName(
      displayName: string,
      sessionUser?: Pick<User, "id" | "email"> | null,
    ): Promise<AuthResult<UserProfile>> {
      return userProfiles.updateCurrentUserDisplayName(displayName, sessionUser)
    },

    async updateCurrentUserAvatarVersion(
      nextAvatarVersion: number,
      sessionUser?: Pick<User, "id" | "email"> | null,
    ): Promise<AuthResult<UserProfile>> {
      return userProfiles.updateCurrentUserAvatarVersion(nextAvatarVersion, sessionUser)
    },

    peekUserProfile(userId: string | null | undefined): UserProfile | null {
      return userProfiles.peekUserProfile(userId)
    },

    async getCurrentUserRole(_userId?: string): Promise<AuthResult<AppRole>> {
      const { data, error } = await this.getUserProfile()
      if (error) {
        return { data: null, error }
      }

      return { data: data?.role ?? null, error: null }
    },

    getSessionAgeMs(): number | null {
      return getSessionAgeMs()
    },

    hasSessionStartedAt(): boolean {
      return hasSessionStartedAt()
    },

    markSessionStartIfMissing(): void {
      markSessionStartIfMissing()
    },

    clearSessionStart(): void {
      clearSessionStartedAtMs()
    },

    isSessionExpired(maxSessionAgeMs: number = ONE_WEEK_MS): boolean {
      return isSessionExpired(maxSessionAgeMs)
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
export type { AppRole, UserProfile, UserStatus, VisitorStatus }
