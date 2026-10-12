import { beforeEach, describe, expect, it, vi } from "vitest"

const harness = vi.hoisted(() => {
  let request: Request | undefined
  return {
    get request() {
      return request
    },
    setRequest(next?: Request) {
      request = next
    },
  }
})

vi.mock("solid-js/web", () => ({
  getRequestEvent: () => (harness.request ? { request: harness.request } : undefined),
}))

import {
  peekRequestAuthProfile,
  rememberRequestAuthProfile,
} from "@/lib/vendor/supabase/request-auth-profile"
import type { UserProfile } from "@/lib/vendor/supabase/user-profile"

const profile = {
  user: { id: "user-1", email: "bob@example.com" },
  role: "superuser",
  profile: { id: "profile-1", displayName: "Bob" },
} as UserProfile

describe("request auth profile", () => {
  beforeEach(() => {
    harness.setRequest(undefined)
  })

  it("returns undefined when there is no request event", () => {
    rememberRequestAuthProfile(profile)
    expect(peekRequestAuthProfile()).toBeUndefined()
  })

  it("remembers a signed-in profile for the current request", () => {
    harness.setRequest(new Request("http://localhost/"))
    rememberRequestAuthProfile(profile)

    expect(peekRequestAuthProfile()).toEqual(profile)
  })

  it("remembers a signed-out result as null, not undefined", () => {
    harness.setRequest(new Request("http://localhost/"))
    rememberRequestAuthProfile(null)

    expect(peekRequestAuthProfile()).toBeNull()
  })

  it("does not leak a profile across requests", () => {
    harness.setRequest(new Request("http://localhost/a"))
    rememberRequestAuthProfile(profile)

    harness.setRequest(new Request("http://localhost/b"))
    expect(peekRequestAuthProfile()).toBeUndefined()
  })
})
