import { describe, expect, it } from "vitest"
import {
  getSupabaseAuthStorageKey,
  resolveBrowserSupabaseUrl,
} from "@/lib/vendor/supabase/browser-url"

describe("browser Supabase URL helpers", () => {
  it("rewrites loopback URLs for non-loopback browser hosts", () => {
    expect(
      resolveBrowserSupabaseUrl("http://localhost:54321", "192.168.4.25"),
    ).toBe("http://192.168.4.25:54321/")
  })

  it("keeps a stable auth storage key from the original configured URL", () => {
    expect(getSupabaseAuthStorageKey("http://localhost:54321")).toBe(
      "bob-yexley-net-localhost-auth-token",
    )
    expect(getSupabaseAuthStorageKey("http://192.168.4.25:54321")).toBe(
      "bob-yexley-net-192-auth-token",
    )
  })
})
