import { query } from "@solidjs/router"
import type { AnalyticsDashboardData, AnalyticsHubStats } from "./types"

export const getAnalyticsDashboard = query(
  async (input: {
    siteId: string
    from: string
    to: string
    bucket: "hour" | "day"
  }): Promise<AnalyticsDashboardData> => {
    "use server"

    const { loadAnalyticsDashboard } = await import("./server")
    return loadAnalyticsDashboard(input)
  },
  "analytics-dashboard",
)

export const getAnalyticsHubStats = query(
  async (input: {
    siteId: string
    from: string
    to: string
  }): Promise<AnalyticsHubStats> => {
    "use server"

    const { loadAnalyticsHubStats } = await import("./server")
    return loadAnalyticsHubStats(input.siteId, input.from, input.to)
  },
  "analytics-hub-stats",
)
