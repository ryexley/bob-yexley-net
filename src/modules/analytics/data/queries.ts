import { query } from "@solidjs/router"
import {
  loadAnalyticsDashboard,
  loadAnalyticsHubStats,
} from "./server"
import type { AnalyticsDashboardData, AnalyticsHubStats } from "./types"

export const getAnalyticsDashboard = query(
  async (input: {
    siteId: string
    from: string
    to: string
    bucket: "hour" | "day"
  }): Promise<AnalyticsDashboardData> => {
    "use server"

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

    return loadAnalyticsHubStats(input.siteId, input.from, input.to)
  },
  "analytics-hub-stats",
)
