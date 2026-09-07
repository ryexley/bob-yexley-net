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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables")
}

const SUPABASE_AUTH_STORAGE_KEY = getSupabaseAuthStorageKey(SUPABASE_URL)

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
  const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: {
      name: SUPABASE_AUTH_STORAGE_KEY,
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
