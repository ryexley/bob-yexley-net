import { describe, expect, it } from "vitest"
import {
  AUTH_SESSION_CACHE_CONTROL,
  applyAuthSessionCacheControl,
  cookieNameMatchesAuthStorageKey,
  requestHasAuthSessionCookie,
} from "@/lib/vendor/supabase/server-session"

const STORAGE_KEY = "bob-yexley-net-localhost-auth-token"

describe("server session cookies", () => {
  it("matches the storage key and chunked cookie names", () => {
    expect(cookieNameMatchesAuthStorageKey(STORAGE_KEY, STORAGE_KEY)).toBe(true)
    expect(cookieNameMatchesAuthStorageKey(`${STORAGE_KEY}.0`, STORAGE_KEY)).toBe(
      true,
    )
    expect(
      cookieNameMatchesAuthStorageKey(`${STORAGE_KEY}-other`, STORAGE_KEY),
    ).toBe(false)
  })

  it("detects a session cookie in a Cookie header", () => {
    expect(requestHasAuthSessionCookie(undefined, STORAGE_KEY)).toBe(false)
    expect(requestHasAuthSessionCookie("", STORAGE_KEY)).toBe(false)
    expect(
      requestHasAuthSessionCookie("theme=dark; session=abc", STORAGE_KEY),
    ).toBe(false)
    expect(
      requestHasAuthSessionCookie(
        `theme=dark; ${STORAGE_KEY}=garbage`,
        STORAGE_KEY,
      ),
    ).toBe(true)
    expect(
      requestHasAuthSessionCookie(`${STORAGE_KEY}.1=chunk`, STORAGE_KEY),
    ).toBe(true)
  })

  it("sets private no-store only when a session cookie is present", () => {
    const signedIn = new Headers()
    applyAuthSessionCacheControl(signedIn, true)
    expect(signedIn.get("Cache-Control")).toBe(AUTH_SESSION_CACHE_CONTROL)

    const anonymous = new Headers({ "Cache-Control": "public, s-maxage=60" })
    applyAuthSessionCacheControl(anonymous, false)
    expect(anonymous.get("Cache-Control")).toBe("public, s-maxage=60")
  })
})
