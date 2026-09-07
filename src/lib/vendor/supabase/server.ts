/**
 * Server request-scoped Supabase client.
 *
 * Trust boundary:
 * - Server-only usage.
 * - Uses anon credentials but binds auth/session via request cookies.
 *
 * Usage:
 * - Use in server queries/loaders/actions that must run as the current user.
 *
 * Do not import `@solidjs/start/http` here. That entry is server-only and
 * crashes the browser if this module ends up in a client chunk.
 */
import { createServerClient } from "@supabase/ssr"
import { getRequestEvent } from "solid-js/web"
import { getSupabaseAuthStorageKey } from "@/lib/vendor/supabase/browser-url"
import type { AppSupabaseClient, Database } from "@/lib/vendor/supabase/types"
import { getEnv } from "@/util/env"

const getSupabasePublicConfig = () => {
  // Call-time read. A top-level `import.meta.env` check throws while the
  // module loads, which Nitro surfaces as an unhandled 500 on API routes
  // when those values were not inlined into the server chunk.
  const env = getEnv()
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Missing required Supabase environment variables")
  }

  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authStorageKey: getSupabaseAuthStorageKey(env.SUPABASE_URL),
  }
}

type CookieWriteOptions = {
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: boolean | "lax" | "strict" | "none"
  secure?: boolean
}

const isHeadersSentError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "ERR_HTTP_HEADERS_SENT"

const readRequestCookies = (): { name: string; value: string }[] => {
  const header = getRequestEvent()?.request.headers.get("Cookie") ?? ""
  if (!header) {
    return []
  }

  return header
    .split(";")
    .flatMap(part => {
      const [name, ...rest] = part.trim().split("=")
      if (!name) {
        return []
      }

      try {
        return [{ name, value: decodeURIComponent(rest.join("=")) }]
      } catch {
        return [{ name, value: rest.join("=") }]
      }
    })
}

const serializeCookie = (
  name: string,
  value: string,
  options: CookieWriteOptions = {},
): string => {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge != null) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }
  if (options.path) {
    parts.push(`Path=${options.path}`)
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }
  if (options.httpOnly) {
    parts.push("HttpOnly")
  }
  if (options.secure) {
    parts.push("Secure")
  }
  if (options.sameSite) {
    const sameSite =
      options.sameSite === true ? "Strict" : String(options.sameSite)
    parts.push(
      `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
    )
  }

  return parts.join("; ")
}

const writeResponseCookie = (
  name: string,
  value: string,
  options: CookieWriteOptions = {},
) => {
  const response = getRequestEvent()?.response
  if (!response) {
    return
  }

  response.headers.append("Set-Cookie", serializeCookie(name, value, options))
}

export async function getServerClient(): Promise<AppSupabaseClient> {
  const { url, anonKey, authStorageKey } = getSupabasePublicConfig()
  const client = createServerClient<Database>(url, anonKey, {
    cookieOptions: {
      name: authStorageKey,
    },
    cookies: {
      getAll() {
        return readRequestCookies()
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          try {
            writeResponseCookie(cookie.name, cookie.value, {
              ...cookie.options,
              path: cookie.options?.path ?? "/",
            })
          } catch (error: unknown) {
            // Cookie refresh is best-effort. A write failure must not 500 the
            // request — the incoming session cookies are still enough to auth.
            if (!isHeadersSentError(error)) {
              console.warn("Failed to persist refreshed auth cookies:", error)
            }
            return
          }
        }
      },
    },
  })

  // Ensure cookie-backed session is initialized before query execution.
  await client.auth.getSession()
  return client
}
