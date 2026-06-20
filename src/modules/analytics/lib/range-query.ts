import { format } from "date-fns/format"
import { isValid } from "date-fns/isValid"
import { parse } from "date-fns/parse"
import { startOfDay } from "date-fns/startOfDay"
import { withWindow } from "@/util/browser"
import {
  resolveAnalyticsCustomRange,
  resolveAnalyticsPresetRange,
  type AnalyticsRangePreset,
  type AnalyticsResolvedRange,
} from "@/modules/analytics/lib/date-range"

export const ANALYTICS_RANGE_QUERY_KEY = "range"
export const ANALYTICS_FROM_QUERY_KEY = "from"
export const ANALYTICS_TO_QUERY_KEY = "to"
export const DEFAULT_ANALYTICS_RANGE_PRESET = "7d" as const

const PRESET_VALUES = new Set<AnalyticsRangePreset>(["24h", "7d", "30d", "90d"])

export type ParsedAnalyticsRangeQuery = {
  preset: AnalyticsRangePreset
  customFrom: Date | null
  customTo: Date | null
  customPanelOpen: boolean
  appliedRange: AnalyticsResolvedRange
}

function parseDateQueryValue(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date())
  if (!isValid(parsed)) {
    return null
  }

  return startOfDay(parsed)
}

export function getDefaultAnalyticsRangeQuery(): ParsedAnalyticsRangeQuery {
  const preset = DEFAULT_ANALYTICS_RANGE_PRESET

  return {
    preset,
    customFrom: null,
    customTo: null,
    customPanelOpen: false,
    appliedRange: resolveAnalyticsPresetRange(preset),
  }
}

export function parseAnalyticsRangeQuery(search: string): ParsedAnalyticsRangeQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  const range = params.get(ANALYTICS_RANGE_QUERY_KEY)

  if (range === "custom") {
    const customFrom = parseDateQueryValue(params.get(ANALYTICS_FROM_QUERY_KEY))
    const customTo = parseDateQueryValue(params.get(ANALYTICS_TO_QUERY_KEY))

    if (customFrom && customTo && customFrom <= customTo) {
      return {
        preset: "custom",
        customFrom,
        customTo,
        customPanelOpen: false,
        appliedRange: resolveAnalyticsCustomRange(customFrom, customTo),
      }
    }
  }

  if (range && PRESET_VALUES.has(range as AnalyticsRangePreset)) {
    const preset = range as Exclude<AnalyticsRangePreset, "custom">

    return {
      preset,
      customFrom: null,
      customTo: null,
      customPanelOpen: false,
      appliedRange: resolveAnalyticsPresetRange(preset),
    }
  }

  return getDefaultAnalyticsRangeQuery()
}

export function buildAnalyticsRangeSearch(
  appliedPreset: AnalyticsRangePreset,
  customFrom: Date | null,
  customTo: Date | null,
) {
  const params = new URLSearchParams()
  params.set(ANALYTICS_RANGE_QUERY_KEY, appliedPreset)

  if (appliedPreset === "custom" && customFrom && customTo) {
    params.set(ANALYTICS_FROM_QUERY_KEY, format(customFrom, "yyyy-MM-dd"))
    params.set(ANALYTICS_TO_QUERY_KEY, format(customTo, "yyyy-MM-dd"))
  }

  return params.toString()
}

export function syncAnalyticsRangeQuery(
  appliedPreset: AnalyticsRangePreset,
  customFrom: Date | null,
  customTo: Date | null,
) {
  withWindow(window => {
    const nextSearch = buildAnalyticsRangeSearch(appliedPreset, customFrom, customTo)
    const nextUrl = `${window.location.pathname}?${nextSearch}`

    if (`${window.location.pathname}${window.location.search}` === nextUrl) {
      return
    }

    window.history.replaceState(null, "", nextUrl)
  })
}
