import { differenceInDays, format, formatDistanceToNow } from "date-fns"
import { enUS } from "date-fns/locale/en-US"
import type { Blip } from "@/modules/blips/data/schema"
import { ptr } from "@/i18n"

const tr = ptr("blips.util.relativeTime")

// Create a custom locale with shorter strings
const shortEnLocale = {
  ...enUS,
  formatDistance: (token: string, count: number) => {
    const formatDistanceLocale: Record<string, string> = {
      lessThanXSeconds: tr("justNow"),
      xSeconds: tr("justNow"),
      halfAMinute: tr("justNow"),
      lessThanXMinutes: tr("minutesAgo", { minutes: count }),
      xMinutes: tr("minutesAgo", { minutes: count }),
      aboutXHours: tr("hoursAgo", { hours: count }),
      xHours: tr("hoursAgo", { hours: count }),
      xDays: tr("daysAgo", { days: count }),
      aboutXWeeks: tr("weeksAgo", { weeks: count }),
      xWeeks: tr("weeksAgo", { weeks: count }),
      aboutXMonths: tr("monthsAgo", { months: count }),
      xMonths: tr("monthsAgo", { months: count }),
      aboutXYears: tr("yearsAgo", { years: count }),
      xYears: tr("yearsAgo", { years: count }),
      overXYears: tr("yearsAgo", { years: count }),
      almostXYears: tr("yearsAgo", { years: count }),
    }

    return formatDistanceLocale[token]
  },
}

const toValidDate = (value?: string | null) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getBlipPublishTimestamp(blip: Pick<Blip, "publish_at" | "created_at">): string {
  return blip.publish_at ?? blip.created_at
}

export function compareBlipsByPublishTimestampDesc(
  left: Pick<Blip, "id" | "publish_at" | "created_at">,
  right: Pick<Blip, "id" | "publish_at" | "created_at">,
): number {
  const timestampDelta =
    new Date(getBlipPublishTimestamp(right)).getTime() -
    new Date(getBlipPublishTimestamp(left)).getTime()

  if (timestampDelta !== 0) {
    return timestampDelta
  }

  const createdAtDelta =
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()

  if (createdAtDelta !== 0) {
    return createdAtDelta
  }

  return right.id.localeCompare(left.id)
}

export function isBlipScheduled(
  blip: Pick<Blip, "published" | "publish_at" | "created_at">,
): boolean {
  if (!blip.published) {
    return false
  }

  const publishDate = toValidDate(getBlipPublishTimestamp(blip))
  if (!publishDate) {
    return false
  }

  return publishDate.getTime() > Date.now()
}

export function isBlipPubliclyVisible(
  blip: Pick<Blip, "published" | "publish_at" | "created_at">,
): boolean {
  if (!blip.published) {
    return false
  }

  return !isBlipScheduled(blip)
}

export function formatBlipTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const daysAgo = differenceInDays(new Date(), date)

  // Just now through 6 days
  if (daysAgo < 7) {
    return formatDistanceToNow(date, { addSuffix: true, locale: shortEnLocale })
  }

  // 7-13 days = last week
  if (daysAgo < 14) {
    return tr("weeksAgo", { weeks: 1 })
  }

  // 14-27 days = X weeks ago
  if (daysAgo < 28) {
    const weeks = Math.floor(daysAgo / 7)
    return tr("weeksAgo", { weeks })
  }

  // 28-59 days = last month
  if (daysAgo < 60) {
    return tr("monthsAgo", { months: 1 })
  }

  // 60+ days but less than a year
  if (daysAgo < 365) {
    const months = Math.floor(daysAgo / 30)
    return tr("monthsAgo", { months })
  }

  // Over 1 year - full date
  return format(date, "MMMM do, yyyy") // "August 20th, 2023"
}

export function formatBlipTimestampFull(timestamp: string): string {
  const date = toValidDate(timestamp)
  if (!date) {
    return timestamp
  }

  return format(date, "MMMM do, yyyy 'at' h:mm a")
}

export function formatBlipScheduledTimestamp(timestamp: string): string {
  const date = toValidDate(timestamp)
  if (!date) {
    return timestamp
  }

  return format(date, "M/d/yyyy h:mm a")
}

export function formatBlipTimestampTooltip(
  blip: Pick<Blip, "published" | "publish_at" | "created_at">,
  formatScheduledTooltip: (fullTimestamp: string) => string,
): string {
  const publishAt = getBlipPublishTimestamp(blip)
  const fullTimestamp = formatBlipTimestampFull(publishAt)

  if (isBlipScheduled(blip)) {
    return formatScheduledTooltip(fullTimestamp)
  }

  return fullTimestamp
}
