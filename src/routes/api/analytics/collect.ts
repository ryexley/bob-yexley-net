import type { APIEvent } from "@solidjs/start/server"
import { getAdminClient } from "@/lib/vendor/supabase/admin"
import { ANALYTICS_SITE_ID } from "@/lib/analytics/constants"
import {
  buildVisitorHash,
  detectBot,
  isAllowedAnalyticsRequest,
  isRateLimited,
  mergeUTM,
  parseReferrerHost,
  parseUserAgent,
  parseUTM,
  resolveAnalyticsRequestOrigin,
} from "@/lib/analytics/collect"

export async function POST({ request }: APIEvent) {
  try {
    if (!isAllowedAnalyticsRequest(request)) {
      return new Response(null, { status: 204 })
    }

    const origin = resolveAnalyticsRequestOrigin(request)

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("cf-connecting-ip") ||
      "0.0.0.0"

    if (isRateLimited(ip)) {
      return new Response(null, { status: 429 })
    }

    const body = await request.json()
    const {
      siteId = ANALYTICS_SITE_ID,
      path,
      pageTitle,
      referrer,
      language,
      screenWidth,
      screenHeight,
      viewportWidth,
      viewportHeight,
    } = body

    if (!siteId || typeof siteId !== "string") {
      return new Response(null, { status: 204 })
    }

    if (!path || typeof path !== "string") {
      return new Response(null, { status: 204 })
    }

    const ua = request.headers.get("user-agent") || ""
    const { isBot, botName } = detectBot(ua)
    const parsedUa = parseUserAgent(ua)
    const acceptLanguage = request.headers.get("accept-language") || language || ""
    const hashSalt = process.env.ANALYTICS_HASH_SALT || ""

    if (!hashSalt) {
      console.error("[analytics] ANALYTICS_HASH_SALT is not configured")
      return new Response(null, { status: 204 })
    }

    const visitorHash = buildVisitorHash(ip, ua, acceptLanguage, hashSalt)
    const referrerHost = parseReferrerHost(referrer)
    const pageUrl = origin ? `${origin}${path}` : path
    const utm = mergeUTM(parseUTM(referrer), parseUTM(pageUrl))

    const { error } = await getAdminClient().from("analytics_events").insert({
      site_id: siteId,
      event_type: "pageview",
      path: path.substring(0, 1000),
      referrer: referrer?.substring(0, 2000) || null,
      referrer_host: referrerHost,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      visitor_hash: visitorHash,
      browser: parsedUa.browser,
      browser_version: parsedUa.browserVersion,
      os: parsedUa.os,
      os_version: parsedUa.osVersion,
      device_type: parsedUa.deviceType,
      screen_width: screenWidth || null,
      screen_height: screenHeight || null,
      viewport_width: viewportWidth || null,
      viewport_height: viewportHeight || null,
      language: language?.substring(0, 20) || null,
      is_bot: isBot,
      bot_name: botName,
      properties:
        typeof pageTitle === "string" && pageTitle.trim()
          ? { title: pageTitle.trim().substring(0, 500) }
          : null,
    })

    if (error) {
      console.error("[analytics]", error)
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[analytics] unexpected error", error)
    return new Response(null, { status: 204 })
  }
}
