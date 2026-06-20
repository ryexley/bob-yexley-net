import { createHash } from "crypto"
import { UAParser } from "ua-parser-js"

export const BOT_UA_PATTERNS = [
  /Googlebot/i,
  /Bingbot/i,
  /Slurp/i,
  /DuckDuckBot/i,
  /Baiduspider/i,
  /YandexBot/i,
  /Sogou/i,
  /Exabot/i,
  /facebot/i,
  /ia_archiver/i,
  /GPTBot/i,
  /ChatGPT-User/i,
  /OAI-SearchBot/i,
  /ClaudeBot/i,
  /Claude-Web/i,
  /PerplexityBot/i,
  /Google-Extended/i,
  /FacebookBot/i,
  /Applebot/i,
  /cohere-ai/i,
  /anthropic-ai/i,
  /YouBot/i,
  /spider/i,
  /crawler/i,
  /scraper/i,
  /bot\b/i,
  /wget/i,
  /curl/i,
  /python-requests/i,
  /HeadlessChrome/i,
  /Puppeteer/i,
  /Playwright/i,
]

export const AI_BOT_NAMES: Record<string, string> = {
  GPTBot: "GPTBot (OpenAI)",
  "ChatGPT-User": "ChatGPT (OpenAI)",
  "OAI-SearchBot": "OpenAI SearchBot",
  ClaudeBot: "ClaudeBot (Anthropic)",
  "Claude-Web": "Claude Web (Anthropic)",
  PerplexityBot: "PerplexityBot",
  "Google-Extended": "Google-Extended (Gemini)",
  FacebookBot: "Meta AI",
  "cohere-ai": "Cohere AI",
  "anthropic-ai": "Anthropic AI",
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

export function isAnalyticsDevelopmentEnvironment() {
  return (
    process.env.NODE_ENV === "development" ||
    import.meta.env?.DEV === true
  )
}

export function isLocalAnalyticsHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

export function isLocalAnalyticsHost(host: string) {
  if (!isAnalyticsDevelopmentEnvironment()) {
    return false
  }

  const hostname = host.split(":")[0]?.toLowerCase() ?? ""
  return isLocalAnalyticsHostname(hostname)
}

export function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT) {
    return true
  }

  entry.count += 1
  return false
}

export function buildVisitorHash(
  ip: string,
  ua: string,
  language: string,
  salt: string,
): string {
  return createHash("sha256")
    .update(`${salt}:${ip}:${ua}:${language}`)
    .digest("hex")
}

export function detectBot(ua: string): { isBot: boolean; botName: string | null } {
  for (const pattern of BOT_UA_PATTERNS) {
    const match = ua.match(pattern)
    if (match) {
      const key = Object.keys(AI_BOT_NAMES).find(entry => new RegExp(entry, "i").test(ua))
      return {
        isBot: true,
        botName: key ? AI_BOT_NAMES[key] : match[0],
      }
    }
  }

  return { isBot: false, botName: null }
}

export function parseReferrerHost(referrer: string | null): string | null {
  if (!referrer) {
    return null
  }

  try {
    return new URL(referrer).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export function parseUTM(url: string | null) {
  if (!url) {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    }
  }

  try {
    const params = new URL(url, "https://placeholder.local").searchParams
    return {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
    }
  } catch {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    }
  }
}

export function mergeUTM(
  ...sources: Array<ReturnType<typeof parseUTM>>
): ReturnType<typeof parseUTM> {
  return sources.reduce(
    (merged, source) => ({
      utm_source: merged.utm_source ?? source.utm_source,
      utm_medium: merged.utm_medium ?? source.utm_medium,
      utm_campaign: merged.utm_campaign ?? source.utm_campaign,
    }),
    {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    },
  )
}

export function parseUserAgent(ua: string) {
  const parser = new UAParser(ua)
  const result = parser.getResult()

  return {
    browser: result.browser.name || null,
    browserVersion: result.browser.version || null,
    os: result.os.name || null,
    osVersion: result.os.version || null,
    deviceType: result.device.type || "desktop",
  }
}

function getConfiguredSiteOrigins() {
  const siteUrl = (
    process.env.VITE_SITE_URL ||
    import.meta.env.VITE_SITE_URL ||
    ""
  ).trim()

  if (!siteUrl) {
    return []
  }

  try {
    const parsed = new URL(siteUrl)
    const origins = new Set<string>([`${parsed.protocol}//${parsed.host}`])

    if (parsed.host.startsWith("www.")) {
      origins.add(`${parsed.protocol}//${parsed.host.slice(4)}`)
    } else {
      origins.add(`${parsed.protocol}//www.${parsed.host}`)
    }

    return [...origins]
  } catch {
    return []
  }
}

export function getAllowedAnalyticsOrigins() {
  const configured = (process.env.ANALYTICS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)

  if (configured.length > 0) {
    return configured
  }

  return getConfiguredSiteOrigins()
}

export function isAllowedAnalyticsOrigin(origin: string) {
  if (!origin) {
    return false
  }

  if (
    isAnalyticsDevelopmentEnvironment() &&
    (() => {
      try {
        return isLocalAnalyticsHostname(new URL(origin).hostname)
      } catch {
        return false
      }
    })()
  ) {
    return true
  }

  return getAllowedAnalyticsOrigins().some(allowed => origin.startsWith(allowed))
}

export function isAllowedAnalyticsHost(host: string) {
  if (isLocalAnalyticsHost(host)) {
    return true
  }

  const allowedOrigins = getAllowedAnalyticsOrigins()
  const hostname = host.split(":")[0]?.toLowerCase() ?? ""

  return allowedOrigins.some(origin => {
    try {
      return new URL(origin).hostname.replace(/^www\./, "") === hostname.replace(/^www\./, "")
    } catch {
      return false
    }
  })
}

export function isAllowedAnalyticsRequest(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && isAllowedAnalyticsOrigin(origin)) {
    return true
  }

  const referer = request.headers.get("referer")
  if (referer) {
    try {
      if (isAllowedAnalyticsOrigin(new URL(referer).origin)) {
        return true
      }
    } catch {
      // Ignore malformed referer values.
    }
  }

  const host = request.headers.get("host")
  if (host && isAllowedAnalyticsHost(host)) {
    return true
  }

  return false
}

export function resolveAnalyticsRequestOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin) {
    return origin
  }

  const referer = request.headers.get("referer")
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      // Ignore malformed referer values.
    }
  }

  const host = request.headers.get("host")
  if (host) {
    const protocol = isLocalAnalyticsHost(host) ? "http" : "https"
    return `${protocol}://${host}`
  }

  return ""
}
