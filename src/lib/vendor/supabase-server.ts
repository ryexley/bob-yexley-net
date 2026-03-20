import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { parseCookies, setCookie } from "vinxi/http"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables")
}

export async function getServerClient(): Promise<SupabaseClient> {
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const cookies = parseCookies()
        return Object.entries(cookies).map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          setCookie(cookie.name, cookie.value, {
            ...cookie.options,
            path: cookie.options?.path ?? "/",
          })
        }
      },
    },
  })

  // Ensure cookie-backed session is initialized before query execution.
  await client.auth.getSession()
  return client
}
