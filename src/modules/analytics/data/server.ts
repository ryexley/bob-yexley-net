import { subMilliseconds } from "date-fns/subMilliseconds"
import { getAdminClient } from "@/lib/vendor/supabase/admin"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import { ANALYTICS_SITE_ID } from "@/lib/analytics/constants"
import type {
  AnalyticsBotTrafficItem,
  AnalyticsDashboardData,
  AnalyticsDashboardQueryInput,
  AnalyticsDeviceBreakdown,
  AnalyticsHubStats,
  AnalyticsRankedItem,
  AnalyticsStatCards,
  AnalyticsStatCardsWithDelta,
  AnalyticsTimeSeriesPoint,
} from "./types"

type RpcStatCardsRow = {
  unique_visitors: number | string | null
  total_pageviews: number | string | null
  views_per_visit: number | string | null
}

type RpcTimeSeriesRow = {
  bucket: string
  pageviews: number | string | null
  unique_visitors: number | string | null
}

type RpcTopPagesRow = {
  path: string
  page_title: string | null
  pageviews: number | string | null
  visitors: number | string | null
}

type RpcTopSourcesRow = {
  source: string
  visitors: number | string | null
}

type RpcDeviceRow = {
  device_type: string
  visitors: number | string | null
}

type RpcBrowserRow = {
  browser: string
  visitors: number | string | null
}

type RpcOsRow = {
  os: string
  visitors: number | string | null
}

type RpcBotRow = {
  bot_name: string
  hits: number | string | null
  distinct_pages_hit: number | string | null
}

type RpcHubStatsRow = {
  total_pageviews: number | string | null
  site_count: number | string | null
}

type RpcSiteIdRow = {
  site_id: string
}

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0)

async function canCurrentRequestAccessAnalytics(): Promise<boolean> {
  const supabase = await getServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    return false
  }

  const { data: profile, error: profileError } = await selectUserProfileRecord(
    supabase,
    user.id,
  )

  if (profileError || !profile) {
    return false
  }

  return profile.role === "superuser"
}

function getPreviousRange(fromIso: string, toIso: string) {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const durationMs = to.getTime() - from.getTime()

  return {
    from: subMilliseconds(from, durationMs).toISOString(),
    to: from.toISOString(),
  }
}

async function loadStatCards(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsStatCards> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_stat_cards", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = ((data ?? [])[0] ?? {}) as RpcStatCardsRow

  return {
    uniqueVisitors: toNumber(row.unique_visitors),
    totalPageviews: toNumber(row.total_pageviews),
    viewsPerVisit: toNumber(row.views_per_visit),
  }
}

async function loadStatCardsWithDelta(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsStatCardsWithDelta> {
  const previousRange = getPreviousRange(from, to)
  const [current, previous] = await Promise.all([
    loadStatCards(siteId, from, to),
    loadStatCards(siteId, previousRange.from, previousRange.to),
  ])

  return { current, previous }
}

async function loadPageviewsOverTime(
  siteId: string,
  from: string,
  to: string,
  bucket: "hour" | "day",
): Promise<AnalyticsTimeSeriesPoint[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_pageviews_over_time", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
    p_bucket: bucket === "hour" ? "1 hour" : "1 day",
  })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RpcTimeSeriesRow[]).map(row => ({
    bucket: row.bucket,
    pageviews: toNumber(row.pageviews),
    uniqueVisitors: toNumber(row.unique_visitors),
  }))
}

async function loadTopPages(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsRankedItem[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_top_pages", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
    p_limit: 20,
  })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RpcTopPagesRow[]).map(row => {
    const path = row.path
    const pageTitle = row.page_title?.trim() || null

    return {
      label: pageTitle || path,
      detail: pageTitle ? path : undefined,
      value: toNumber(row.visitors),
      secondaryValue: toNumber(row.pageviews),
    }
  })
}

async function loadTopSources(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsRankedItem[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_top_sources", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
    p_limit: 20,
  })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RpcTopSourcesRow[]).map(row => ({
    label: row.source,
    value: toNumber(row.visitors),
  }))
}

async function loadDeviceBreakdown(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsDeviceBreakdown> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_device_breakdown", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
  })

  if (error) {
    throw new Error(error.message)
  }

  const breakdown: AnalyticsDeviceBreakdown = {
    mobile: 0,
    tablet: 0,
    desktop: 0,
  }

  for (const row of (data ?? []) as RpcDeviceRow[]) {
    const key = row.device_type as keyof AnalyticsDeviceBreakdown
    if (key in breakdown) {
      breakdown[key] = toNumber(row.visitors)
    }
  }

  return breakdown
}

async function loadBrowserBreakdown(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsRankedItem[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_browser_breakdown", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
    p_limit: 10,
  })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RpcBrowserRow[]).map(row => ({
    label: row.browser,
    value: toNumber(row.visitors),
  }))
}

async function loadOsBreakdown(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsRankedItem[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_os_breakdown", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
    p_limit: 10,
  })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RpcOsRow[]).map(row => ({
    label: row.os,
    value: toNumber(row.visitors),
  }))
}

async function loadAiBotTraffic(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsBotTrafficItem[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_ai_bot_traffic", {
    p_site_id: siteId,
    p_from: from,
    p_to: to,
  })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RpcBotRow[]).map(row => ({
    botName: row.bot_name,
    hits: toNumber(row.hits),
    distinctPagesHit: toNumber(row.distinct_pages_hit),
  }))
}

async function loadSiteIds(): Promise<string[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient.rpc("analytics_site_ids")

  if (error) {
    throw new Error(error.message)
  }

  const siteIds = ((data ?? []) as RpcSiteIdRow[])
    .map(row => row.site_id)
    .filter(Boolean)

  if (siteIds.length === 0) {
    return [ANALYTICS_SITE_ID]
  }

  return siteIds
}

export async function loadAnalyticsDashboard(
  input: AnalyticsDashboardQueryInput,
): Promise<AnalyticsDashboardData> {
  const authorized = await canCurrentRequestAccessAnalytics()
  if (!authorized) {
    return {
      authorized: false,
      error: null,
      siteIds: [],
      statCards: null,
      pageviewsOverTime: [],
      topPages: [],
      topSources: [],
      deviceBreakdown: null,
      browserBreakdown: [],
      osBreakdown: [],
      aiBotTraffic: [],
    }
  }

  try {
    const [
      siteIds,
      statCards,
      pageviewsOverTime,
      topPages,
      topSources,
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      aiBotTraffic,
    ] = await Promise.all([
      loadSiteIds(),
      loadStatCardsWithDelta(input.siteId, input.from, input.to),
      loadPageviewsOverTime(input.siteId, input.from, input.to, input.bucket),
      loadTopPages(input.siteId, input.from, input.to),
      loadTopSources(input.siteId, input.from, input.to),
      loadDeviceBreakdown(input.siteId, input.from, input.to),
      loadBrowserBreakdown(input.siteId, input.from, input.to),
      loadOsBreakdown(input.siteId, input.from, input.to),
      loadAiBotTraffic(input.siteId, input.from, input.to),
    ])

    return {
      authorized: true,
      error: null,
      siteIds,
      statCards,
      pageviewsOverTime,
      topPages,
      topSources,
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      aiBotTraffic,
    }
  } catch (error) {
    console.error("Failed to load analytics dashboard:", error)
    return {
      authorized: true,
      error: "Unable to load analytics right now.",
      siteIds: [ANALYTICS_SITE_ID],
      statCards: null,
      pageviewsOverTime: [],
      topPages: [],
      topSources: [],
      deviceBreakdown: null,
      browserBreakdown: [],
      osBreakdown: [],
      aiBotTraffic: [],
    }
  }
}

export async function loadAnalyticsHubStats(
  siteId: string,
  from: string,
  to: string,
): Promise<AnalyticsHubStats> {
  const authorized = await canCurrentRequestAccessAnalytics()
  if (!authorized) {
    return {
      authorized: false,
      error: null,
      totalPageviews30d: 0,
      siteCount: 0,
    }
  }

  try {
    const adminClient = getAdminClient()
    const { data, error } = await adminClient.rpc("analytics_admin_hub_stats", {
      p_site_id: siteId,
      p_from: from,
      p_to: to,
    })

    if (error) {
      throw new Error(error.message)
    }

    const row = ((data ?? [])[0] ?? {}) as RpcHubStatsRow

    return {
      authorized: true,
      error: null,
      totalPageviews30d: toNumber(row.total_pageviews),
      siteCount: Math.max(toNumber(row.site_count), 1),
    }
  } catch (error) {
    console.error("Failed to load analytics hub stats:", error)
    return {
      authorized: true,
      error: "Unable to load analytics stats right now.",
      totalPageviews30d: 0,
      siteCount: 1,
    }
  }
}
