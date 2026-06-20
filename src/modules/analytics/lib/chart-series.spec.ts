import { describe, expect, it } from "vitest"
import { normalizePageviewsOverTime } from "@/modules/analytics/lib/chart-series"

describe("normalizePageviewsOverTime", () => {
  it("centers sparse hourly data within the selected window", () => {
    const activeBucket = new Date("2026-05-26T18:00:00.000Z")
    const normalized = normalizePageviewsOverTime(
      [
        {
          bucket: activeBucket.toISOString(),
          pageviews: 12,
          uniqueVisitors: 2,
        },
      ],
      new Date("2026-05-25T18:00:00.000Z"),
      new Date("2026-05-26T18:00:00.000Z"),
      "hour",
    )

    expect(normalized).toHaveLength(25)

    const activeIndex = normalized.findIndex(point => point.pageviews > 0)
    expect(activeIndex).toBeGreaterThan(0)
    expect(activeIndex).toBeLessThan(normalized.length - 1)
    expect(activeIndex).toBe(Math.floor((normalized.length - 1) / 2))
  })

  it("centers sparse daily data within the selected window", () => {
    const activeDay = new Date("2026-05-11T12:00:00.000Z")
    const normalized = normalizePageviewsOverTime(
      [
        {
          bucket: activeDay.toISOString(),
          pageviews: 9,
          uniqueVisitors: 2,
        },
      ],
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-30T00:00:00.000Z"),
      "day",
    )

    expect(normalized).toHaveLength(30)

    const activeIndex = normalized.findIndex(point => point.pageviews > 0)
    expect(activeIndex).toBe(Math.floor((normalized.length - 1) / 2))
  })
})
