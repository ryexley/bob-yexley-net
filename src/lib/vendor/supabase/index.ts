/**
 * Supabase client barrel.
 *
 * Exposes explicit clients by trust boundary:
 * - browser: anon + client auth/session flows
 * - server: anon + request-scoped cookie session context
 * - admin: service-role privileged server client
 */
export * from "./browser"
export * from "./server"
export * from "./admin"
export * from "./types"
