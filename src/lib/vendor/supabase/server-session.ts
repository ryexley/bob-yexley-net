/**
 * Pure helpers for cookie-backed Supabase sessions on the server.
 *
 * Kept free of `solid-js/web` and `@supabase/ssr` so unit tests can cover
 * cookie detection and cache headers without a request event.
 */

export const AUTH_SESSION_CACHE_CONTROL = "private, no-store"

export function cookieNameMatchesAuthStorageKey(
  cookieName: string,
  storageKey: string,
): boolean {
  return cookieName === storageKey || cookieName.startsWith(`${storageKey}.`)
}

export function requestHasAuthSessionCookie(
  cookieHeader: string | null | undefined,
  storageKey: string,
): boolean {
  if (!cookieHeader || !storageKey) {
    return false
  }

  return cookieHeader.split(";").some(part => {
    const name = part.trim().split("=")[0]
    return Boolean(name) && cookieNameMatchesAuthStorageKey(name, storageKey)
  })
}

export function applyAuthSessionCacheControl(
  headers: { set(name: string, value: string): void } | undefined | null,
  hasSessionCookie: boolean,
) {
  if (!headers || !hasSessionCookie) {
    return
  }

  headers.set("Cache-Control", AUTH_SESSION_CACHE_CONTROL)
}
