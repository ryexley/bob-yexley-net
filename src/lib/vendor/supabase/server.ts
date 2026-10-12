/**
 * Server request-scoped Supabase client.
 *
 * Trust boundary:
 * - Server-only usage.
 * - Uses anon credentials but binds auth/session via request cookies.
 * - Validates the session with `getUser` (not just JWT decode). An expired
 *   access token with a valid refresh token is rotated and written back to
 *   the response. A missing or garbage session renders as signed out.
 *
 * Usage:
 * - Use in server queries/loaders/actions that must run as the current user.
 *
 * Do not import `@solidjs/start/http` here. That entry is server-only and
 * crashes the browser if this module ends up in a client chunk.
 */
import { createServerClient } from "@supabase/ssr"
import { createClient, type User } from "@supabase/supabase-js"
import { getRequestEvent } from "solid-js/web"
import { getSupabaseAuthStorageKey } from "@/lib/vendor/supabase/browser-url"
import {
  applyAuthSessionCacheControl,
  requestHasAuthSessionCookie,
} from "@/lib/vendor/supabase/server-session"
import type { AppSupabaseClient, Database } from "@/lib/vendor/supabase/types"
import { getEnv } from "@/util/env"

export type ServerAuth = {
  client: AppSupabaseClient
  user: User | null
}

const authByRequest = new WeakMap<Request, Promise<ServerAuth>>()

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

const applyRequestAuthCacheHeaders = (authStorageKey: string) => {
  const event = getRequestEvent()
  if (!event) {
    return
  }

  applyAuthSessionCacheControl(
    event.response?.headers,
    requestHasAuthSessionCookie(
      event.request.headers.get("Cookie"),
      authStorageKey,
    ),
  )
}

const createAnonymousServerClient = (
  url: string,
  anonKey: string,
): AppSupabaseClient =>
  createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

const createCookieServerClient = (
  url: string,
  anonKey: string,
  authStorageKey: string,
): AppSupabaseClient =>
  createServerClient<Database>(url, anonKey, {
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

const resolveValidatedUser = async (
  client: AppSupabaseClient,
): Promise<User | null> => {
  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser()
    if (error || !user?.id) {
      return null
    }
    return user
  } catch {
    return null
  }
}

const initializeServerAuth = async (): Promise<ServerAuth> => {
  const { url, anonKey, authStorageKey } = getSupabasePublicConfig()
  applyRequestAuthCacheHeaders(authStorageKey)

  try {
    const cookieClient = createCookieServerClient(url, anonKey, authStorageKey)
    const user = await resolveValidatedUser(cookieClient)

    if (!user) {
      try {
        await cookieClient.auth.signOut({ scope: "local" })
      } catch {
        // Clearing a garbage session must not fail the request.
      }
      return {
        client: createAnonymousServerClient(url, anonKey),
        user: null,
      }
    }

    return { client: cookieClient, user }
  } catch (error) {
    console.warn("Failed to initialize server auth session:", error)
    return {
      client: createAnonymousServerClient(url, anonKey),
      user: null,
    }
  }
}

/**
 * Validated request-scoped auth. `getUser` runs once per request: expired
 * access tokens refresh through `@supabase/ssr` cookie helpers; invalid
 * cookies become a signed-out anonymous client.
 */
export async function getServerAuth(): Promise<ServerAuth> {
  const request = getRequestEvent()?.request
  if (!request) {
    return initializeServerAuth()
  }

  const existing = authByRequest.get(request)
  if (existing) {
    return existing
  }

  const created = initializeServerAuth()
  authByRequest.set(request, created)
  return created
}

export async function getServerClient(): Promise<AppSupabaseClient> {
  const { client } = await getServerAuth()
  return client
}
