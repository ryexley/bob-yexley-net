/**
 * Server privileged Supabase admin client.
 *
 * Trust boundary:
 * - Server-only usage.
 * - Uses `SUPABASE_SERVICE_ROLE_KEY` and must NEVER run in browser code.
 *
 * Usage:
 * - Use for privileged operations (e.g. admin user creation).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getEnv } from "@/util/env"

let adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const env = getEnv()
    const supabaseUrl = env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ""
    const serviceRoleKey =
      env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""

    const missing: string[] = []
    if (!supabaseUrl) {
      missing.push("SUPABASE_URL (or VITE_SUPABASE_URL)")
    }
    if (!serviceRoleKey) {
      missing.push("SUPABASE_SERVICE_ROLE_KEY")
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing required Supabase admin environment variables: ${missing.join(", ")}`,
      )
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return adminClient
}

export const getSupabaseAdminClient = getAdminClient
