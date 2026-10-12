/**
 * Request-scoped auth profile for SSR first paint.
 *
 * `createAsync` serializes the profile into the hydration payload, but the
 * resource is often still unresolved while AuthProvider first renders. Effects
 * never run on the server, so we stash the already-validated profile on the
 * current Request and read it synchronously during SSR.
 */
import { getRequestEvent } from "solid-js/web"
import type { UserProfile } from "@/lib/vendor/supabase/user-profile"

const profileByRequest = new WeakMap<Request, UserProfile | null>()

export function rememberRequestAuthProfile(profile: UserProfile | null) {
  const request = getRequestEvent()?.request
  if (!request) {
    return
  }

  profileByRequest.set(request, profile)
}

export function peekRequestAuthProfile(): UserProfile | null | undefined {
  const request = getRequestEvent()?.request
  if (!request || !profileByRequest.has(request)) {
    return undefined
  }

  return profileByRequest.get(request)
}
