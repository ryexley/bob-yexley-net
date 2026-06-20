import { describe, expect, it } from "vitest"
import {
  buildAnalyticsRangeSearch,
  DEFAULT_ANALYTICS_RANGE_PRESET,
  getDefaultAnalyticsRangeQuery,
  parseAnalyticsRangeQuery,
} from "@/modules/analytics/lib/range-query"

describe("analytics range query", () => {
  it("defaults to 7 days", () => {
    expect(DEFAULT_ANALYTICS_RANGE_PRESET).toBe("7d")
    expect(getDefaultAnalyticsRangeQuery().preset).toBe("7d")
    expect(parseAnalyticsRangeQuery("").preset).toBe("7d")
  })

  it("parses preset ranges from the query string", () => {
    expect(parseAnalyticsRangeQuery("?range=30d").preset).toBe("30d")
    expect(parseAnalyticsRangeQuery("?range=24h").appliedRange.bucket).toBe("hour")
  })

  it("parses custom ranges from the query string", () => {
    const parsed = parseAnalyticsRangeQuery("?range=custom&from=2026-05-01&to=2026-05-07")

    expect(parsed.preset).toBe("custom")
    expect(parsed.customFrom).not.toBeNull()
    expect(parsed.customTo).not.toBeNull()
  })

  it("serializes preset and custom ranges", () => {
    expect(buildAnalyticsRangeSearch("7d", null, null)).toBe("range=7d")
    expect(
      buildAnalyticsRangeSearch(
        "custom",
        new Date("2026-05-01T12:00:00.000Z"),
        new Date("2026-05-07T12:00:00.000Z"),
      ),
    ).toBe("range=custom&from=2026-05-01&to=2026-05-07")
  })
})
