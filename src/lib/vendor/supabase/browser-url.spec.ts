import { describe, expect, it } from "vitest"
import { resolveBrowserSupabaseUrl } from "@/lib/vendor/supabase/browser-url"

describe("browser-url", () => {
  it("keeps non-loopback supabase hosts unchanged", () => {
    expect(
      resolveBrowserSupabaseUrl(
        "https://project-ref.supabase.co",
        "192.168.1.50",
      ),
    ).toBe("https://project-ref.supabase.co")
  })

  it("keeps loopback supabase hosts unchanged for localhost browsing", () => {
    expect(
      resolveBrowserSupabaseUrl(
        "http://127.0.0.1:54321",
        "127.0.0.1",
      ),
    ).toBe("http://127.0.0.1:54321")
  })

  it("rewrites loopback supabase hosts to the current browser hostname", () => {
    expect(
      resolveBrowserSupabaseUrl(
        "http://127.0.0.1:54321",
        "192.168.1.50",
      ),
    ).toBe("http://192.168.1.50:54321/")
  })

  it("rewrites localhost supabase hosts to the current browser hostname", () => {
    expect(
      resolveBrowserSupabaseUrl(
        "http://localhost:54321",
        "bob-phone.local",
      ),
    ).toBe("http://bob-phone.local:54321/")
  })

  it("returns the original value for invalid URLs", () => {
    expect(resolveBrowserSupabaseUrl("not-a-url", "192.168.1.50")).toBe(
      "not-a-url",
    )
  })
})
