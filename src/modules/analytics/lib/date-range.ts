import { endOfDay } from "date-fns/endOfDay"
import { startOfDay } from "date-fns/startOfDay"
import { subDays } from "date-fns/subDays"
import { subHours } from "date-fns/subHours"

export type AnalyticsRangePreset = "24h" | "7d" | "30d" | "90d" | "custom"

export type AnalyticsResolvedRange = {
  preset: AnalyticsRangePreset
  from: Date
  to: Date
  bucket: "hour" | "day"
}

export function resolveAnalyticsPresetRange(
  preset: Exclude<AnalyticsRangePreset, "custom">,
): AnalyticsResolvedRange {
  const to = new Date()

  if (preset === "24h") {
    return {
      preset,
      from: subHours(to, 24),
      to,
      bucket: "hour",
    }
  }

  const dayCount = preset === "7d" ? 7 : preset === "30d" ? 30 : 90

  return {
    preset,
    from: startOfDay(subDays(to, dayCount - 1)),
    to,
    bucket: "day",
  }
}

export function resolveAnalyticsCustomRange(from: Date, to: Date): AnalyticsResolvedRange {
  const normalizedFrom = startOfDay(from)
  const normalizedTo = endOfDay(to)
  const durationMs = normalizedTo.getTime() - normalizedFrom.getTime()
  const bucket = durationMs <= 36 * 60 * 60 * 1000 ? "hour" : "day"

  return {
    preset: "custom",
    from: normalizedFrom,
    to: normalizedTo,
    bucket,
  }
}

export function computeDeltaPercent(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null
  }

  return ((current - previous) / previous) * 100
}

export function formatAnalyticsBucketLabel(value: string, bucket: "hour" | "day") {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  if (bucket === "hour") {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
    })
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
