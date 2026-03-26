import { describe, expect, it, vi } from "vitest"
import { AUTH_RPC } from "@/lib/vendor/supabase/auth-rpc-names"
import { createSessionRpcService } from "@/lib/vendor/supabase/session-rpc-service"

describe("session-rpc-service", () => {
  it("dedupes concurrent start_session calls", async () => {
    const rpc = vi.fn(async () => ({ error: null }))
    const service = createSessionRpcService({
      getClient: () => ({ rpc }) as never,
    })

    const [first, second] = await Promise.all([
      service.openCurrentSession("7 days"),
      service.openCurrentSession("7 days"),
    ])

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ data: null, error: null })
    expect(second).toEqual({ data: null, error: null })
  })

  it("normalizes session_is_valid into a boolean result", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }))
    const service = createSessionRpcService({
      getClient: () => ({ rpc }) as never,
    })

    await expect(service.isServerSessionValid("7 days")).resolves.toEqual({
      data: true,
      error: null,
    })
    expect(rpc).toHaveBeenCalledWith(AUTH_RPC.isServerSessionValid, {
      max_age: "7 days",
    })
  })
})
