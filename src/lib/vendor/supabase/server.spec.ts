import { beforeEach, describe, expect, it, vi } from "vitest"
import { AUTH_SESSION_CACHE_CONTROL } from "@/lib/vendor/supabase/server-session"

const STORAGE_KEY = "bob-yexley-net-localhost-auth-token"

const harness = vi.hoisted(() => {
  let cookie = ""
  let request = { headers: { get: (_name: string) => null as string | null } }
  let responseHeaders = new Headers()
  const getUser = vi.fn()
  const signOut = vi.fn()
  let lastSetAll:
    | ((
        cookies: { name: string; value: string; options?: object }[],
        headers?: Record<string, string>,
      ) => void)
    | undefined

  const createRequest = () => {
    cookie = ""
    responseHeaders = new Headers()
    request = {
      headers: {
        get(name: string) {
          return name.toLowerCase() === "cookie" ? cookie : null
        },
      },
    }
  }

  createRequest()

  return {
    getUser,
    signOut,
    get cookie() {
      return cookie
    },
    set cookie(value: string) {
      cookie = value
    },
    get request() {
      return request
    },
    get responseHeaders() {
      return responseHeaders
    },
    get lastSetAll() {
      return lastSetAll
    },
    setLastSetAll(
      fn:
        | ((
            cookies: { name: string; value: string; options?: object }[],
            headers?: Record<string, string>,
          ) => void)
        | undefined,
    ) {
      lastSetAll = fn
    },
    reset() {
      getUser.mockReset()
      signOut.mockReset()
      lastSetAll = undefined
      createRequest()
    },
  }
})

vi.mock("solid-js/web", () => ({
  getRequestEvent: () => ({
    request: harness.request,
    response: { headers: harness.responseHeaders },
  }),
}))

vi.mock("@/util/env", () => ({
  getEnv: () => ({
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_ANON_KEY: "anon-key",
  }),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: { name: string; value: string; options?: object }[],
          headers?: Record<string, string>,
        ) => void
      }
    },
  ) => {
    harness.setLastSetAll(options.cookies.setAll)
    return {
      kind: "cookie",
      auth: {
        getUser: harness.getUser,
        signOut: harness.signOut,
      },
    }
  },
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    kind: "anon",
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  }),
}))

import { getServerAuth, getServerClient } from "@/lib/vendor/supabase/server"

describe("getServerAuth", () => {
  beforeEach(() => {
    harness.reset()
  })

  it("returns a signed-in cookie client and private cache headers", async () => {
    harness.cookie = `${STORAGE_KEY}=valid-session`
    harness.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "bob@example.com" } },
      error: null,
    })

    const first = await getServerAuth()
    const second = await getServerAuth()

    expect(first.user?.id).toBe("user-1")
    expect((first.client as { kind?: string }).kind).toBe("cookie")
    expect(second).toBe(first)
    expect(harness.getUser).toHaveBeenCalledTimes(1)
    expect(harness.responseHeaders.get("Cache-Control")).toBe(
      AUTH_SESSION_CACHE_CONTROL,
    )
    expect(await getServerClient()).toBe(first.client)
  })

  it("rotates cookies when getUser refreshes an expired access token", async () => {
    harness.cookie = `${STORAGE_KEY}=expired-access`
    harness.getUser.mockImplementation(async () => {
      harness.lastSetAll?.(
        [
          {
            name: STORAGE_KEY,
            value: "rotated",
            options: { path: "/", maxAge: 3600 },
          },
        ],
        {
          "Cache-Control":
            "private, no-cache, no-store, must-revalidate, max-age=0",
        },
      )
      return {
        data: { user: { id: "user-1", email: "bob@example.com" } },
        error: null,
      }
    })

    const { user, client } = await getServerAuth()

    expect(user?.id).toBe("user-1")
    expect((client as { kind?: string }).kind).toBe("cookie")
    expect(harness.responseHeaders.get("Set-Cookie")).toContain(
      `${STORAGE_KEY}=rotated`,
    )
    expect(harness.responseHeaders.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    )
  })

  it("renders signed out for a garbage session cookie without throwing", async () => {
    harness.cookie = `${STORAGE_KEY}=not-a-jwt`
    harness.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "invalid JWT" },
    })

    const { user, client } = await getServerAuth()

    expect(user).toBeNull()
    expect((client as { kind?: string }).kind).toBe("anon")
    expect(harness.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(harness.responseHeaders.get("Cache-Control")).toBe(
      AUTH_SESSION_CACHE_CONTROL,
    )
  })

  it("treats a throwing getUser as signed out", async () => {
    harness.cookie = `${STORAGE_KEY}=garbage`
    harness.getUser.mockRejectedValue(new Error("Auth session missing"))

    await expect(getServerAuth()).resolves.toEqual({
      client: expect.objectContaining({ kind: "anon" }),
      user: null,
    })
  })

  it("keeps anonymous responses uncached", async () => {
    harness.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing" },
    })

    const { user } = await getServerAuth()

    expect(user).toBeNull()
    expect(harness.responseHeaders.get("Cache-Control")).toBeNull()
  })
})
