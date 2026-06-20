import { addDays } from "date-fns/addDays"
import { addHours } from "date-fns/addHours"
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays"
import { differenceInHours } from "date-fns/differenceInHours"
import { startOfDay } from "date-fns/startOfDay"
import { startOfHour } from "date-fns/startOfHour"
import { subDays } from "date-fns/subDays"
import type { AnalyticsTimeSeriesPoint } from "@/modules/analytics/data/types"

const MIN_DAY_BUCKETS = 7
const MIN_HOUR_BUCKETS = 24

function bucketKey(value: Date, bucket: "hour" | "day") {
  const normalized = bucket === "hour" ? startOfHour(value) : startOfDay(value)
  return normalized.toISOString()
}

function normalizeBucketDate(value: Date, bucket: "hour" | "day") {
  return bucket === "hour" ? startOfHour(value) : startOfDay(value)
}

function generateBucketDates(from: Date, to: Date, bucket: "hour" | "day") {
  const buckets: Date[] = []
  let cursor = normalizeBucketDate(from, bucket)
  const end = normalizeBucketDate(to, bucket)

  while (cursor <= end) {
    buckets.push(new Date(cursor))
    cursor = bucket === "hour" ? addHours(cursor, 1) : addDays(cursor, 1)
  }

  return buckets
}

function countBuckets(from: Date, to: Date, bucket: "hour" | "day") {
  return generateBucketDates(from, to, bucket).length
}

function getDataExtent(points: AnalyticsTimeSeriesPoint[], bucket: "hour" | "day") {
  const activeBuckets = points
    .filter(point => point.pageviews > 0 || point.uniqueVisitors > 0)
    .map(point => normalizeBucketDate(new Date(point.bucket), bucket))
    .sort((left, right) => left.getTime() - right.getTime())

  if (activeBuckets.length === 0) {
    return null
  }

  const first = activeBuckets[0]
  const last = activeBuckets[activeBuckets.length - 1]
  const spanBuckets =
    bucket === "hour"
      ? differenceInHours(last, first) + 1
      : differenceInCalendarDays(last, first) + 1

  return { first, last, spanBuckets }
}

function resolveEmptyChartRange(
  normalizedFrom: Date,
  normalizedTo: Date,
  bucket: "hour" | "day",
  minBuckets: number,
) {
  const windowBuckets = countBuckets(normalizedFrom, normalizedTo, bucket)

  if (windowBuckets >= minBuckets) {
    return {
      from: normalizedFrom,
      to: normalizedTo,
    }
  }

  if (bucket === "hour") {
    return {
      from: addHours(normalizedTo, -(minBuckets - 1)),
      to: normalizedTo,
    }
  }

  return {
    from: startOfDay(subDays(normalizedTo, minBuckets - 1)),
    to: normalizedTo,
  }
}

function resolveChartRange(
  points: AnalyticsTimeSeriesPoint[],
  from: Date,
  to: Date,
  bucket: "hour" | "day",
) {
  const normalizedFrom = normalizeBucketDate(from, bucket)
  const normalizedTo = normalizeBucketDate(to, bucket)
  const minBuckets = bucket === "hour" ? MIN_HOUR_BUCKETS : MIN_DAY_BUCKETS
  const windowBuckets = countBuckets(normalizedFrom, normalizedTo, bucket)
  const targetWindow = Math.max(windowBuckets, minBuckets)
  const dataExtent = getDataExtent(points, bucket)

  if (!dataExtent) {
    return resolveEmptyChartRange(normalizedFrom, normalizedTo, bucket, minBuckets)
  }

  if (dataExtent.spanBuckets >= targetWindow) {
    return {
      from: normalizedFrom,
      to: normalizedTo,
    }
  }

  const paddingTotal = targetWindow - dataExtent.spanBuckets
  const paddingBefore = Math.floor(paddingTotal / 2)
  const paddingAfter = paddingTotal - paddingBefore

  if (bucket === "hour") {
    return {
      from: addHours(dataExtent.first, -paddingBefore),
      to: addHours(dataExtent.last, paddingAfter),
    }
  }

  return {
    from: startOfDay(subDays(dataExtent.first, paddingBefore)),
    to: startOfDay(addDays(dataExtent.last, paddingAfter)),
  }
}

export function normalizePageviewsOverTime(
  points: AnalyticsTimeSeriesPoint[],
  from: Date,
  to: Date,
  bucket: "hour" | "day",
): AnalyticsTimeSeriesPoint[] {
  const chartRange = resolveChartRange(points, from, to, bucket)
  const buckets = generateBucketDates(chartRange.from, chartRange.to, bucket)
  const pointsByBucket = new Map(
    points.map(point => [bucketKey(new Date(point.bucket), bucket), point]),
  )

  return buckets.map(date => {
    const key = bucketKey(date, bucket)
    const existing = pointsByBucket.get(key)

    return {
      bucket: date.toISOString(),
      pageviews: existing?.pageviews ?? 0,
      uniqueVisitors: existing?.uniqueVisitors ?? 0,
    }
  })
}

export function computeAverageDailyPageviews(
  totalPageviews: number,
  from: Date,
  to: Date,
  bucket: "hour" | "day",
) {
  const dayCount =
    bucket === "hour"
      ? 1
      : Math.max(differenceInCalendarDays(startOfDay(to), startOfDay(from)) + 1, 1)

  return totalPageviews / dayCount
}

export function formatViewsPerVisit(value: number) {
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatAverageDailyPageviews(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}
