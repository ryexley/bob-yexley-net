import type { SupabaseClient } from "@supabase/supabase-js"
import { AUTH_RPC } from "@/lib/vendor/supabase/auth-rpc-names"

export type AuthResult<T = any> = {
  data: T | null
  error: string | null
}

type FailedVisitorLoginAttemptResult = {
  found: boolean
  locked: boolean
  failed_attempts: number
}

type SessionRpcServiceDeps = {
  getClient: () => SupabaseClient
}

export function createSessionRpcService({ getClient }: SessionRpcServiceDeps) {
  let inFlightOpenSession: Promise<AuthResult<void>> | null = null

  return {
    async openCurrentSession(ttl: string): Promise<AuthResult<void>> {
      try {
        if (inFlightOpenSession) {
          return inFlightOpenSession
        }

        inFlightOpenSession = (async () => {
          const { error } = await getClient().rpc(AUTH_RPC.openCurrentSession, { ttl })
          if (error) {
            return { data: null, error: error.message }
          }

          return { data: null, error: null }
        })()

        return await inFlightOpenSession
      } catch (error) {
        console.error("Open current session error:", error)
        return {
          data: null,
          error: "An unexpected error occurred while opening session",
        }
      } finally {
        inFlightOpenSession = null
      }
    },

    async revokeCurrentSession(): Promise<AuthResult<void>> {
      try {
        const { error } = await getClient().rpc(AUTH_RPC.revokeCurrentSession)
        if (error) {
          return { data: null, error: error.message }
        }

        return { data: null, error: null }
      } catch (error) {
        console.error("Revoke current session error:", error)
        return {
          data: null,
          error: "An unexpected error occurred while revoking session",
        }
      }
    },

    async isServerSessionValid(maxAge: string): Promise<AuthResult<boolean>> {
      try {
        const { data, error } = await getClient().rpc(AUTH_RPC.isServerSessionValid, {
          max_age: maxAge,
        })

        if (error) {
          return { data: null, error: error.message }
        }

        return { data: data === true, error: null }
      } catch (error) {
        console.error("Server session validity check error:", error)
        return {
          data: null,
          error: "An unexpected error occurred while validating session",
        }
      }
    },

    async recordFailedVisitorLoginAttempt(
      targetEmail: string,
      maxAttempts: number,
    ): Promise<FailedVisitorLoginAttemptResult> {
      const normalizedEmail = targetEmail?.trim().toLowerCase()
      if (!normalizedEmail) {
        return { found: false, locked: false, failed_attempts: 0 }
      }

      try {
        const { data, error } = await getClient().rpc(AUTH_RPC.recordFailedVisitorLoginAttempt, {
          target_email: normalizedEmail,
          max_attempts: maxAttempts,
        })

        if (error) {
          console.error("Failed to record visitor login attempt:", error)
          return { found: false, locked: false, failed_attempts: 0 }
        }

        return {
          found: data?.found === true,
          locked: data?.locked === true,
          failed_attempts:
            typeof data?.failed_attempts === "number" ? data.failed_attempts : 0,
        }
      } catch (error) {
        console.error("recordFailedVisitorLoginAttempt error:", error)
        return { found: false, locked: false, failed_attempts: 0 }
      }
    },

    async resetCurrentVisitorFailedLoginAttempts(): Promise<AuthResult<void>> {
      try {
        const { error } = await getClient().rpc(
          AUTH_RPC.resetCurrentVisitorFailedLoginAttempts,
        )
        if (error) {
          return { data: null, error: error.message }
        }

        return { data: null, error: null }
      } catch (error) {
        console.error("resetCurrentVisitorFailedLoginAttempts error:", error)
        return {
          data: null,
          error: "An unexpected error occurred while resetting login attempts",
        }
      }
    },
  }
}
