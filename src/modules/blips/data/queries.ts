import { query } from "@solidjs/router"
import {
  BLIP_TYPES,
  type Blip,
} from "@/modules/blips/data/schema"

type ViewTagRow = {
  id: string
  name: string
  description: string | null
}

type ViewUpdateRow = Omit<Blip, "tags" | "updates_count"> & {
  tags?: ViewTagRow[] | null
  updates_count?: number | null
}

type ViewBlipRow = Omit<Blip, "tags" | "updates_count"> & {
  tags?: ViewTagRow[] | null
  updates_count?: number | null
  updates?: ViewUpdateRow[] | null
}

export type BlipGraph = {
  blip: Blip
  updates: Blip[]
}

type QuerySummary = Record<string, unknown>
type QueryAggregateEntry = {
  count: number
  errors: number
  totalDurationMs: number
  maxDurationMs: number
  slowCount: number
}

const shouldLogQueryMetrics = () =>
  import.meta.env.DEV || process.env.BLIPS_QUERY_DEBUG === "1"

const getSlowQueryThresholdMs = () => {
  const raw = Number(process.env.BLIPS_QUERY_SLOW_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 250
}

const getInFlightBySignature = () => {
  const globalKey = "__blipsQueryInFlightBySignature"
  const globalStore = globalThis as typeof globalThis & {
    [key: string]: Map<string, number> | undefined
  }
  if (!globalStore[globalKey]) {
    globalStore[globalKey] = new Map<string, number>()
  }
  return globalStore[globalKey] as Map<string, number>
}

const getAggregateMetricsStore = () => {
  const statsKey = "__blipsQueryAggregateByName"
  const flushTsKey = "__blipsQueryAggregateLastFlushTs"
  const globalStore = globalThis as typeof globalThis & {
    [key: string]: Map<string, QueryAggregateEntry> | number | undefined
  }

  if (!globalStore[statsKey]) {
    globalStore[statsKey] = new Map<string, QueryAggregateEntry>()
  }
  if (!globalStore[flushTsKey]) {
    globalStore[flushTsKey] = Date.now()
  }

  return {
    byName: globalStore[statsKey] as Map<string, QueryAggregateEntry>,
    getLastFlushTs: () => (globalStore[flushTsKey] as number) ?? Date.now(),
    setLastFlushTs: (ts: number) => {
      globalStore[flushTsKey] = ts
    },
  }
}

const nextQueryTraceId = (queryName: string) =>
  `${queryName}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`

const logQueryStart = (
  queryName: string,
  traceId: string,
  meta: QuerySummary,
  inFlightCount: number,
) => {
  const level = inFlightCount > 1 ? "warn" : "log"
  console[level](`[blips.query:start] ${queryName}`, {
    traceId,
    inFlightCount,
    ...meta,
  })
}

const logQueryEnd = (
  queryName: string,
  traceId: string,
  durationMs: number,
  summary: QuerySummary,
) => {
  const slowThresholdMs = getSlowQueryThresholdMs()
  const level = durationMs >= slowThresholdMs ? "warn" : "log"
  console[level](`[blips.query:end] ${queryName}`, {
    traceId,
    durationMs,
    slowThresholdMs,
    slow: durationMs >= slowThresholdMs,
    ...summary,
  })
}

const logQueryError = (
  queryName: string,
  traceId: string,
  durationMs: number,
  error: unknown,
) => {
  console.error(`[blips.query:error] ${queryName}`, {
    traceId,
    durationMs,
    error,
  })
}

const recordAggregateMetric = (
  queryName: string,
  durationMs: number,
  hadError: boolean,
) => {
  const store = getAggregateMetricsStore()
  const existing = store.byName.get(queryName) ?? {
    count: 0,
    errors: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    slowCount: 0,
  }
  const slowThresholdMs = getSlowQueryThresholdMs()

  const next: QueryAggregateEntry = {
    count: existing.count + 1,
    errors: existing.errors + (hadError ? 1 : 0),
    totalDurationMs: existing.totalDurationMs + durationMs,
    maxDurationMs: Math.max(existing.maxDurationMs, durationMs),
    slowCount: existing.slowCount + (durationMs >= slowThresholdMs ? 1 : 0),
  }

  store.byName.set(queryName, next)
}

const maybeFlushAggregateMetrics = () => {
  const flushIntervalMs = 30_000
  const now = Date.now()
  const store = getAggregateMetricsStore()
  if (now - store.getLastFlushTs() < flushIntervalMs) {
    return
  }

  if (store.byName.size === 0) {
    store.setLastFlushTs(now)
    return
  }

  const snapshot = [...store.byName.entries()].map(([queryName, metrics]) => ({
    queryName,
    calls: metrics.count,
    errors: metrics.errors,
    slowCalls: metrics.slowCount,
    avgMs: Number((metrics.totalDurationMs / metrics.count).toFixed(1)),
    maxMs: metrics.maxDurationMs,
  }))

  console.log("[blips.query:aggregate] rolling 30s", {
    windowMs: flushIntervalMs,
    slowThresholdMs: getSlowQueryThresholdMs(),
    queries: snapshot,
  })

  store.byName.clear()
  store.setLastFlushTs(now)
}

const withQueryMetrics = async <T>(
  queryName: string,
  meta: QuerySummary,
  operation: () => Promise<T>,
  summarizeResult: (result: T) => QuerySummary = () => ({}),
): Promise<T> => {
  if (!shouldLogQueryMetrics()) {
    return operation()
  }

  const traceId = nextQueryTraceId(queryName)
  const startedAt = Date.now()
  const signature = JSON.stringify([queryName, meta])
  const inFlightBySignature = getInFlightBySignature()
  const inFlightCount = (inFlightBySignature.get(signature) ?? 0) + 1
  inFlightBySignature.set(signature, inFlightCount)
  logQueryStart(queryName, traceId, meta, inFlightCount)

  try {
    const result = await operation()
    const durationMs = Date.now() - startedAt
    logQueryEnd(queryName, traceId, durationMs, summarizeResult(result))
    recordAggregateMetric(queryName, durationMs, false)
    return result
  } catch (error) {
    const durationMs = Date.now() - startedAt
    logQueryError(queryName, traceId, durationMs, error)
    recordAggregateMetric(queryName, durationMs, true)
    throw error
  } finally {
    const remaining = (inFlightBySignature.get(signature) ?? 1) - 1
    if (remaining <= 0) {
      inFlightBySignature.delete(signature)
    } else {
      inFlightBySignature.set(signature, remaining)
    }
    maybeFlushAggregateMetrics()
  }
}

const VIEW_BLIPS_SELECT = [
  "id",
  "parent_id",
  "user_id",
  "title",
  "content",
  "published",
  "moderation_status",
  "created_at",
  "updated_at",
  "blip_type",
  "tags",
  "updates_count",
].join(", ")

const VIEW_BLIP_GRAPH_SELECT = `${VIEW_BLIPS_SELECT}, updates`

const mapTagNames = (tags?: ViewTagRow[] | null): string[] => {
  return [...new Set((tags ?? []).map(tag => tag?.name).filter(Boolean))].sort()
}

const mapViewBlipRow = (row: ViewBlipRow): Blip => ({
  id: row.id,
  parent_id: row.parent_id,
  user_id: row.user_id,
  title: row.title,
  content: row.content,
  published: row.published,
  moderation_status: row.moderation_status,
  created_at: row.created_at,
  updated_at: row.updated_at,
  blip_type: row.blip_type,
  tags: mapTagNames(row.tags),
  updates_count: row.updates_count ?? 0,
})

const mapViewUpdateRows = (rows?: ViewUpdateRow[] | null): Blip[] =>
  (rows ?? []).map(row => ({
    id: row.id,
    parent_id: row.parent_id,
    user_id: row.user_id,
    title: row.title,
    content: row.content,
    published: row.published,
    moderation_status: row.moderation_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    blip_type: row.blip_type,
    tags: mapTagNames(row.tags),
    updates_count: row.updates_count ?? 0,
  }))

const isRootBlip = (blip: Pick<Blip, "parent_id" | "blip_type">) =>
  blip.parent_id === null && blip.blip_type === BLIP_TYPES.ROOT

export const getBlips = query(async (limit: number = 20, offset: number = 0) => {
  "use server"

  return withQueryMetrics(
    "getBlips",
    { limit, offset },
    async () => {
      const { getServerClient } = await import("@/lib/vendor/supabase-server")
      const supabase = await getServerClient()

      const { data, error } = await supabase
        .from("view_blips")
        .select(VIEW_BLIPS_SELECT)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return ((data ?? []) as unknown as ViewBlipRow[]).map(mapViewBlipRow)
    },
    result => ({
      rowCount: result.length,
    }),
  )
}, "blips")

export const getBlipsByTag = query(async (
  tag: string,
  limit: number = 20,
  offset: number = 0,
) => {
  "use server"

  if (!tag) {
    return []
  }

  return withQueryMetrics(
    "getBlipsByTag",
    { tag, limit, offset },
    async () => {
      const { getServerClient } = await import("@/lib/vendor/supabase-server")
      const supabase = await getServerClient()

      const { data, error } = await supabase
        .from("view_blips")
        .select(VIEW_BLIPS_SELECT)
        .contains("tags", [{ name: tag }])
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return ((data ?? []) as unknown as ViewBlipRow[]).map(mapViewBlipRow)
    },
    result => ({
      rowCount: result.length,
    }),
  )
}, "blips-by-tag")

export const getBlip = query(async (id: string) => {
  "use server"

  return withQueryMetrics(
    "getBlip",
    { id },
    async () => {
      const { getServerClient } = await import("@/lib/vendor/supabase-server")
      const supabase = await getServerClient()

      const { data, error } = await supabase
        .from("view_blips")
        .select(VIEW_BLIPS_SELECT)
        .eq("id", id)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        return null
      }

      if (!isRootBlip(data as unknown as Pick<Blip, "parent_id" | "blip_type">)) {
        return null
      }

      return mapViewBlipRow(data as unknown as ViewBlipRow)
    },
    result => ({
      found: result !== null,
    }),
  )
}, "blip")

export const getBlipGraph = query(async (id: string): Promise<BlipGraph | null> => {
  "use server"

  return withQueryMetrics(
    "getBlipGraph",
    { id },
    async () => {
      const { getServerClient } = await import("@/lib/vendor/supabase-server")
      const supabase = await getServerClient()

      const { data, error } = await supabase
        .from("view_blips")
        .select(VIEW_BLIP_GRAPH_SELECT)
        .eq("id", id)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        return null
      }

      const root = mapViewBlipRow(data as unknown as ViewBlipRow)
      if (!isRootBlip(root)) {
        return null
      }

      return {
        blip: root,
        updates: mapViewUpdateRows((data as unknown as ViewBlipRow).updates),
      }
    },
    result => ({
      found: result !== null,
      updatesCount: result?.updates.length ?? 0,
    }),
  )
}, "blip-graph")

