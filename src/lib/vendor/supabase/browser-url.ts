const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"])

const isLoopbackHostname = (hostname?: string | null) =>
  Boolean(hostname) && LOOPBACK_HOSTNAMES.has(hostname.trim().toLowerCase())

export const resolveBrowserSupabaseUrl = (
  supabaseUrl: string,
  browserHostname?: string | null,
) => {
  if (!supabaseUrl) {
    return supabaseUrl
  }

  if (!browserHostname || isLoopbackHostname(browserHostname)) {
    return supabaseUrl
  }

  try {
    const resolvedUrl = new URL(supabaseUrl)
    if (!isLoopbackHostname(resolvedUrl.hostname)) {
      return supabaseUrl
    }

    resolvedUrl.hostname = browserHostname
    return resolvedUrl.toString()
  } catch {
    return supabaseUrl
  }
}
