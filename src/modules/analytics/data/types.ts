export type AnalyticsDateRange = {
  from: string
  to: string
}

export type AnalyticsStatCards = {
  uniqueVisitors: number
  totalPageviews: number
  viewsPerVisit: number
}

export type AnalyticsStatCardsWithDelta = {
  current: AnalyticsStatCards
  previous: AnalyticsStatCards
}

export type AnalyticsTimeSeriesPoint = {
  bucket: string
  pageviews: number
  uniqueVisitors: number
}

export type AnalyticsRankedItem = {
  label: string
  value: number
  secondaryValue?: number
  detail?: string
}

export type AnalyticsDeviceBreakdown = {
  mobile: number
  tablet: number
  desktop: number
}

export type AnalyticsBotTrafficItem = {
  botName: string
  hits: number
  distinctPagesHit: number
}

export type AnalyticsDashboardData = {
  authorized: boolean
  error: string | null
  siteIds: string[]
  statCards: AnalyticsStatCardsWithDelta | null
  pageviewsOverTime: AnalyticsTimeSeriesPoint[]
  topPages: AnalyticsRankedItem[]
  topSources: AnalyticsRankedItem[]
  deviceBreakdown: AnalyticsDeviceBreakdown | null
  browserBreakdown: AnalyticsRankedItem[]
  osBreakdown: AnalyticsRankedItem[]
  aiBotTraffic: AnalyticsBotTrafficItem[]
}

export type AnalyticsHubStats = {
  authorized: boolean
  error: string | null
  totalPageviews30d: number
  siteCount: number
}

export type AnalyticsDashboardQueryInput = {
  siteId: string
  from: string
  to: string
  bucket: "hour" | "day"
}
