type AnalyticsBeaconOptions = {
  siteId: string
  endpoint: string
  isSuperuser: boolean
}

type AnalyticsPageviewOptions = {
  siteId: string
  endpoint: string
  path: string
}

function canRecord(isSuperuser: boolean) {
  if (isSuperuser) {
    return false
  }

  if (typeof window === "undefined") {
    return false
  }

  const hostname = window.location.hostname
  return hostname !== "localhost" && hostname !== "127.0.0.1"
}

function buildPayload(path: string, siteId: string) {
  const pageTitle = document.title?.trim() || null

  return {
    siteId,
    path,
    pageTitle,
    referrer: document.referrer || null,
    language: navigator.language || null,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }
}

function sendPayload(endpoint: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }))
    return
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {})
}

export function initAnalytics(opts: AnalyticsBeaconOptions) {
  if (!canRecord(opts.isSuperuser)) {
    return
  }
}

export function trackAnalyticsPageview(opts: AnalyticsPageviewOptions) {
  if (typeof window === "undefined") {
    return
  }

  sendPayload(opts.endpoint, buildPayload(opts.path, opts.siteId))
}
