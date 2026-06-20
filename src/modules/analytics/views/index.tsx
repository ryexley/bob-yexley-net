import { createAsync, useLocation, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import type { ChartData } from "chart.js"
import { BarChart } from "@/components/analytics/bar-chart"
import { DeviceBreakdown } from "@/components/analytics/device-breakdown"
import { PageviewsChart } from "@/components/analytics/pageviews-chart"
import { RankedList } from "@/components/analytics/ranked-list"
import { StatCard } from "@/components/analytics/stat-card"
import { Icon, LoadingSpinner } from "@/components/icon"
import { useAuth } from "@/context/auth-context"
import { RequiresSuperUser } from "@/modules/auth/components/requires-role"
import { AnalyticsDateRangePicker } from "@/modules/analytics/components/date-range-picker"
import { getAnalyticsDashboard } from "@/modules/analytics/data/queries"
import type { AnalyticsDashboardData } from "@/modules/analytics/data/types"
import type { AnalyticsRangePreset, AnalyticsResolvedRange } from "@/modules/analytics/lib/date-range"
import {
  computeDeltaPercent,
  formatAnalyticsBucketLabel,
  resolveAnalyticsCustomRange,
  resolveAnalyticsPresetRange,
} from "@/modules/analytics/lib/date-range"
import {
  computeAverageDailyPageviews,
  formatAverageDailyPageviews,
  formatViewsPerVisit,
  normalizePageviewsOverTime,
} from "@/modules/analytics/lib/chart-series"
import {
  parseAnalyticsRangeQuery,
  syncAnalyticsRangeQuery,
} from "@/modules/analytics/lib/range-query"
import { ANALYTICS_SITE_ID } from "@/lib/analytics/constants"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import "./index.css"

const tr = ptr("analytics.views.index")

export function AnalyticsView() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const initialRange = parseAnalyticsRangeQuery(location.search || "")
  const [siteId, setSiteId] = createSignal(ANALYTICS_SITE_ID)
  const [activePreset, setActivePreset] = createSignal<AnalyticsRangePreset>(
    initialRange.preset,
  )
  const [appliedPreset, setAppliedPreset] = createSignal<AnalyticsRangePreset>(
    initialRange.preset,
  )
  const [customPanelOpen, setCustomPanelOpen] = createSignal(initialRange.customPanelOpen)
  const [customFrom, setCustomFrom] = createSignal<Date | null>(initialRange.customFrom)
  const [customTo, setCustomTo] = createSignal<Date | null>(initialRange.customTo)
  const [appliedRange, setAppliedRange] = createSignal<AnalyticsResolvedRange>(
    initialRange.appliedRange,
  )
  const [cachedDashboard, setCachedDashboard] = createSignal<AnalyticsDashboardData | null>(
    null,
  )

  const persistAppliedRange = (
    preset: AnalyticsRangePreset,
    range: AnalyticsResolvedRange,
    from: Date | null = customFrom(),
    to: Date | null = customTo(),
  ) => {
    setAppliedPreset(preset)
    setAppliedRange(range)
    if (preset === "custom") {
      setCustomFrom(from)
      setCustomTo(to)
    }
  }

  const handlePresetSelect = (preset: AnalyticsRangePreset) => {
    if (preset === "custom") {
      if (customPanelOpen()) {
        setCustomPanelOpen(false)
        setActivePreset(appliedPreset())
        return
      }

      setCustomPanelOpen(true)
      setActivePreset("custom")
      return
    }

    setCustomPanelOpen(false)
    setActivePreset(preset)
    persistAppliedRange(preset, resolveAnalyticsPresetRange(preset))
  }

  createEffect(() => {
    if (!customPanelOpen()) {
      return
    }

    const from = customFrom()
    const to = customTo()
    if (!from || !to || from > to) {
      return
    }

    setActivePreset("custom")
    persistAppliedRange("custom", resolveAnalyticsCustomRange(from, to), from, to)
  })

  createEffect(() => {
    syncAnalyticsRangeQuery(
      appliedPreset(),
      appliedPreset() === "custom" ? customFrom() : null,
      appliedPreset() === "custom" ? customTo() : null,
    )
  })

  const dashboardQuery = createAsync(() => {
    const range = appliedRange()

    return getAnalyticsDashboard({
      siteId: siteId(),
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      bucket: range.bucket,
    })
  })

  createEffect(() => {
    const result = dashboardQuery()
    if (result !== undefined) {
      setCachedDashboard(result)
    }
  })

  const dashboard = createMemo(() => dashboardQuery() ?? cachedDashboard())

  createEffect(() => {
    if (auth.loading()) {
      return
    }

    if (!auth.isSuperuser()) {
      navigate(auth.isAuthenticated() ? pages.home : pages.login, {
        replace: true,
      })
    }
  })

  createEffect(() => {
    const result = dashboardQuery()
    if (auth.loading() || !auth.isSuperuser() || result === undefined) {
      return
    }

    if (!result.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const siteOptions = createMemo(() => {
    const ids = dashboard()?.siteIds ?? [ANALYTICS_SITE_ID]
    return ids.map(id => ({
      value: id,
      label: id,
    }))
  })

  const statCards = createMemo(() => dashboard()?.statCards ?? null)
  const normalizedPageviewsOverTime = createMemo(() => {
    const range = appliedRange()

    return normalizePageviewsOverTime(
      dashboard()?.pageviewsOverTime ?? [],
      range.from,
      range.to,
      range.bucket,
    )
  })
  const averageDailyPageviews = createMemo(() => {
    const cards = statCards()
    if (!cards) {
      return { current: 0, previous: 0 }
    }

    const range = appliedRange()
    return {
      current: computeAverageDailyPageviews(
        cards.current.totalPageviews,
        range.from,
        range.to,
        range.bucket,
      ),
      previous: computeAverageDailyPageviews(
        cards.previous.totalPageviews,
        new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime())),
        range.from,
        range.bucket,
      ),
    }
  })
  const pageviewsChartData = createMemo<ChartData<"line">>(() => {
    const points = normalizedPageviewsOverTime()
    const bucket = appliedRange().bucket

    return {
      labels: points.map(point => formatAnalyticsBucketLabel(point.bucket, bucket)),
      datasets: [
        {
          label: tr("charts.pageviews"),
          data: points.map(point => point.pageviews),
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          fill: true,
        },
        {
          label: tr("charts.visitors"),
          data: points.map(point => point.uniqueVisitors),
          borderColor: "rgb(16, 185, 129)",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
        },
      ],
    }
  })

  const browserChartData = createMemo<ChartData<"bar">>(() => {
    const items = dashboard()?.browserBreakdown ?? []

    return {
      labels: items.map(item => item.label),
      datasets: [
        {
          label: tr("charts.visitors"),
          data: items.map(item => item.value),
          backgroundColor: "rgba(59, 130, 246, 0.65)",
        },
      ],
    }
  })

  const osChartData = createMemo<ChartData<"bar">>(() => {
    const items = dashboard()?.osBreakdown ?? []

    return {
      labels: items.map(item => item.label),
      datasets: [
        {
          label: tr("charts.visitors"),
          data: items.map(item => item.value),
          backgroundColor: "rgba(16, 185, 129, 0.65)",
        },
      ],
    }
  })

  const isInitialLoad = createMemo(
    () => dashboard() === null && auth.isSuperuser(),
  )

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="analytics-view">
        <a
          href={pages.admin}
          class="analytics-view-back-link">
          <Icon name="arrow_back" />
          {tr("actions.backToAdmin")}
        </a>
        <div class="analytics-view-shell">
          <div class="analytics-view-header">
            <div class="analytics-view-header-copy">
              <h1 class="analytics-view-title">{tr("title")}</h1>
              <p class="analytics-view-subtitle">{tr("subtitle")}</p>
            </div>
            <AnalyticsDateRangePicker
              activePreset={activePreset()}
              customPanelOpen={customPanelOpen()}
              customFrom={customFrom()}
              customTo={customTo()}
              siteId={siteId()}
              siteOptions={siteOptions()}
              onPresetSelect={handlePresetSelect}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
              onSiteIdChange={setSiteId}
            />
          </div>

          <RequiresSuperUser
            fallback={
              <div class="analytics-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            <Show
              when={!isInitialLoad()}
              fallback={
                <div class="analytics-view-loading-state">
                  <LoadingSpinner size="2rem" />
                  <p>{tr("loading")}</p>
                </div>
              }>
              <Show when={dashboard()?.error}>
                <div class="analytics-view-error">{dashboard()?.error}</div>
              </Show>

              <section class="analytics-view-stat-grid">
                <StatCard
                  label={tr("stats.uniqueVisitors")}
                  value={statCards()?.current.uniqueVisitors.toLocaleString() ?? "0"}
                  delta={computeDeltaPercent(
                    statCards()?.current.uniqueVisitors ?? 0,
                    statCards()?.previous.uniqueVisitors ?? 0,
                  )}
                />
                <StatCard
                  label={tr("stats.totalPageviews")}
                  value={statCards()?.current.totalPageviews.toLocaleString() ?? "0"}
                  delta={computeDeltaPercent(
                    statCards()?.current.totalPageviews ?? 0,
                    statCards()?.previous.totalPageviews ?? 0,
                  )}
                />
                <StatCard
                  label={tr("stats.viewsPerVisit")}
                  value={formatViewsPerVisit(statCards()?.current.viewsPerVisit ?? 0)}
                  delta={computeDeltaPercent(
                    statCards()?.current.viewsPerVisit ?? 0,
                    statCards()?.previous.viewsPerVisit ?? 0,
                  )}
                />
                <StatCard
                  label={tr("stats.avgDailyPageviews")}
                  value={formatAverageDailyPageviews(averageDailyPageviews().current)}
                  delta={computeDeltaPercent(
                    averageDailyPageviews().current,
                    averageDailyPageviews().previous,
                  )}
                />
              </section>

              <section class="analytics-view-panel">
                <h2 class="analytics-view-panel-title">{tr("panels.pageviewsOverTime")}</h2>
                <PageviewsChart data={pageviewsChartData()} />
              </section>

              <div class="analytics-view-grid">
                <section class="analytics-view-panel">
                  <h2 class="analytics-view-panel-title">{tr("panels.topPages")}</h2>
                  <RankedList
                    items={dashboard()?.topPages ?? []}
                    secondaryValueLabel={tr("labels.pageviews")}
                  />
                </section>
                <section class="analytics-view-panel">
                  <h2 class="analytics-view-panel-title">{tr("panels.topSources")}</h2>
                  <RankedList items={dashboard()?.topSources ?? []} />
                </section>
              </div>

              <div class="analytics-view-grid">
                <section class="analytics-view-panel">
                  <h2 class="analytics-view-panel-title">{tr("panels.browsers")}</h2>
                  <BarChart data={browserChartData()} />
                </section>
                <section class="analytics-view-panel">
                  <h2 class="analytics-view-panel-title">{tr("panels.operatingSystems")}</h2>
                  <BarChart data={osChartData()} />
                </section>
              </div>

              <div class="analytics-view-grid">
                <section class="analytics-view-panel">
                  <h2 class="analytics-view-panel-title">{tr("panels.devices")}</h2>
                  <DeviceBreakdown
                    mobile={dashboard()?.deviceBreakdown?.mobile ?? 0}
                    tablet={dashboard()?.deviceBreakdown?.tablet ?? 0}
                    desktop={dashboard()?.deviceBreakdown?.desktop ?? 0}
                  />
                </section>
                <section class="analytics-view-panel">
                  <h2 class="analytics-view-panel-title">{tr("panels.aiBots")}</h2>
                  <RankedList
                    items={(dashboard()?.aiBotTraffic ?? []).map(item => ({
                      label: item.botName,
                      value: item.hits,
                      secondaryValue: item.distinctPagesHit,
                    }))}
                    emptyLabel={tr("empty.aiBots")}
                    secondaryValueLabel={tr("labels.pages")}
                  />
                </section>
              </div>
            </Show>
          </RequiresSuperUser>
        </div>
      </main>
    </>
  )
}

export default AnalyticsView
