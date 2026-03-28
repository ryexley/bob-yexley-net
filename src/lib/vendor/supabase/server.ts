/**
 * Server request-scoped Supabase client.
 *
 * Trust boundary:
 * - Server-only usage.
 * - Uses anon credentials but binds auth/session via request cookies.
 *
 * Usage:
 * - Use in server queries/loaders/actions that must run as the current user.
 */
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getEvent, parseCookies, setCookie } from "vinxi/http"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables")
}

const isHeadersSentError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "ERR_HTTP_HEADERS_SENT"

export async function getServerClient(): Promise<SupabaseClient> {
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const cookies = parseCookies()
        return Object.entries(cookies).map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        const event = getEvent()
        const response = event?.node?.res
        // Supabase can emit cookie updates late in the request lifecycle.
        // Skip writes when headers are already finalized.
        if (
          response?.headersSent ||
          response?.writableEnded ||
          response?.destroyed
        ) {
          return
        }

        for (const cookie of cookies) {
          try {
            setCookie(cookie.name, cookie.value, {
              ...cookie.options,
              path: cookie.options?.path ?? "/",
            })
          } catch (error: unknown) {
            if (isHeadersSentError(error)) {
              return
            }
            throw error
          }
        }
      },
    },
  })

  // Ensure cookie-backed session is initialized before query execution.
  await client.auth.getSession()
  return client
}
