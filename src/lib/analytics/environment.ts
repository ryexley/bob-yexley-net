const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"])

export function isAnalyticsDevelopmentEnvironment() {
  return (
    import.meta.env?.DEV === true ||
    import.meta.env?.MODE === "development"
  )
}

export function isLocalAnalyticsHostname(hostname: string) {
  return LOCAL_DEV_HOSTNAMES.has(hostname)
}

export function shouldRecordAnalyticsClientSide(isSuperuser: boolean) {
  if (typeof window === "undefined" || isSuperuser) {
    return false
  }

  const hostname = window.location.hostname
  if (isLocalAnalyticsHostname(hostname)) {
    return isAnalyticsDevelopmentEnvironment()
  }

  return true
}
