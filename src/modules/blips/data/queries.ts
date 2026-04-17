import type { SupabaseClient } from "@supabase/supabase-js"
import { query } from "@solidjs/router"
import {
  BLIP_TYPES,
  type Blip,
  type BlipAuthor,
} from "@/modules/blips/data/schema"
import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"

type ViewTagRow = {
  id: string
  name: string
  description: string | null
}

type ViewTagValue = ViewTagRow | string

type ViewAuthorValue = {
  profile_id?: string | null
  display_name?: string | null
  avatar_seed?: string | null
  avatar_version?: number | null
}

type ViewCommentRow = Omit<Blip, "tags" | "updates_count" | "reactions"> & {
  author?: ViewAuthorValue | null
}

type ViewUpdateRow = Omit<Blip, "tags" | "updates_count"> & {
  tags?: ViewTagValue[] | null
  updates_count?: number | null
  reactions_count?: number | null
  my_reaction_count?: number | null
  reactions?: ViewReactionValue[] | null
  comments?: ViewCommentRow[] | null
}

type ViewBlipRow = Omit<Blip, "tags" | "updates_count"> & {
  tags?: ViewTagValue[] | null
  updates_count?: number | null
  updates?: ViewUpdateRow[] | null
  reactions_count?: number | null
  my_reaction_count?: number | null
  reactions?: ViewReactionValue[] | null
  comments?: ViewCommentRow[] | null
}

type ViewReactionValue = {
  emoji?: string | null
  count?: number | null
  reacted_by_current_user?: boolean | null
  display_names?: string[] | null
}

type VisibleReactionRow = {
  blip_id?: string | null
  emoji?: string | null
  user_id?: string | null
  display_name?: string | null
}

export type BlipReactionState = {
  reactions_count: number
  my_reaction_count: number
  reactions: BlipReactionSummary[]
}

export type BlipGraph = {
  blip: ThreadedBlip
  updates: ThreadedBlip[]
}

export type ThreadedBlip = Blip & {
  comments: Blip[]
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
  "allow_comments",
  "tags",
  "updates_count",
  "reactions_count",
  "my_reaction_count",
  "reactions",
].join(", ")

const VIEW_BLIP_GRAPH_SELECT = `${VIEW_BLIPS_SELECT}, comments, updates`

const mapTagNames = (tags?: ViewTagValue[] | null): string[] =>
  [
    ...new Set(
      (tags ?? [])
        .map(tag => {
          if (typeof tag === "string") {
            return tag
          }
          return tag?.name
        })
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort()

const mapAuthor = (author?: ViewAuthorValue | null): BlipAuthor | undefined => {
  if (!author) {
    return undefined
  }

  return {
    profile_id: author.profile_id ?? null,
    display_name: author.display_name ?? null,
    avatar_seed: author.avatar_seed ?? null,
    avatar_version:
      typeof author.avatar_version === "number" ? author.avatar_version : null,
  }
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
  allow_comments: row.allow_comments ?? true,
  tags: mapTagNames(row.tags),
  updates_count: row.updates_count ?? 0,
  reactions_count: row.reactions_count ?? 0,
  my_reaction_count: row.my_reaction_count ?? 0,
  reactions: mapReactionSummaries(row.reactions),
  author: mapAuthor(row.author),
})

const mapReactionSummaries = (
  reactions?: ViewReactionValue[] | null,
): BlipReactionSummary[] =>
  (reactions ?? [])
    .map(reaction => {
      const emoji = reaction?.emoji?.trim()
      if (!emoji) {
        return null
      }

      const displayNames = [...new Set((reaction.display_names ?? []).filter(Boolean))]
      return {
        emoji,
        count: typeof reaction.count === "number" ? reaction.count : 0,
        reacted_by_current_user: reaction.reacted_by_current_user === true,
        display_names: displayNames,
      } satisfies BlipReactionSummary
    })
    .filter((reaction): reaction is BlipReactionSummary => reaction !== null)

export const buildBlipReactionStates = (
  blipIds: string[],
  rows: VisibleReactionRow[],
  currentUserId: string | null,
): Record<string, BlipReactionState> => {
  const states = Object.fromEntries(
    [...new Set(blipIds.filter(Boolean))].map(blipId => [
      blipId,
      {
        reactions_count: 0,
        my_reaction_count: 0,
        reactions: [],
      } satisfies BlipReactionState,
    ]),
  )

  const grouped = new Map<
    string,
    Map<string, { count: number; reacted_by_current_user: boolean; display_names: string[] }>
  >()

  for (const row of rows) {
    const blipId = row.blip_id?.trim()
    const emoji = row.emoji?.trim()
    if (!blipId || !emoji || !(blipId in states)) {
      continue
    }

    const byEmoji = grouped.get(blipId) ?? new Map()
    const current =
      byEmoji.get(emoji) ?? {
        count: 0,
        reacted_by_current_user: false,
        display_names: [],
      }

    current.count += 1
    if (row.user_id && row.user_id === currentUserId) {
      current.reacted_by_current_user = true
    }

    const displayName = row.display_name?.trim()
    if (displayName && !current.display_names.includes(displayName)) {
      current.display_names.push(displayName)
      current.display_names.sort()
    }

    byEmoji.set(emoji, current)
    grouped.set(blipId, byEmoji)
  }

  for (const [blipId, byEmoji] of grouped) {
    const reactions = [...byEmoji.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([emoji, summary]) => ({
        emoji,
        count: summary.count,
        reacted_by_current_user: summary.reacted_by_current_user,
        display_names: summary.display_names,
      }))

    states[blipId] = {
      reactions_count: reactions.reduce((total, reaction) => total + reaction.count, 0),
      my_reaction_count: reactions.filter(reaction => reaction.reacted_by_current_user).length,
      reactions,
    }
  }

  return states
}

const getCurrentUserId = async (supabase: SupabaseClient): Promise<string | null> => {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      throw error
    }

    return data.user?.id ?? null
  } catch {
    return null
  }
}

export async function getBlipReactionState(
  supabase: SupabaseClient,
  blipId: string,
): Promise<BlipReactionState | null> {
  if (!blipId) {
    return null
  }

  const currentUserId = await getCurrentUserId(supabase)
  const { data, error } = await supabase
    .from("view_reactions_public")
    .select("blip_id, emoji, user_id, display_name")
    .eq("blip_id", blipId)

  if (error) {
    throw error
  }

  return buildBlipReactionStates(
    [blipId],
    (data ?? []) as VisibleReactionRow[],
    currentUserId,
  )[blipId] ?? null
}

export async function getBlipReactionStates(
  supabase: SupabaseClient,
  blipIds: string[],
): Promise<Record<string, BlipReactionState>> {
  const targetIds = [...new Set(blipIds.filter(Boolean))]
  if (targetIds.length === 0) {
    return {}
  }

  const currentUserId = await getCurrentUserId(supabase)
  const { data, error } = await supabase
    .from("view_reactions_public")
    .select("blip_id, emoji, user_id, display_name")
    .in("blip_id", targetIds)

  if (error) {
    throw error
  }

  return buildBlipReactionStates(
    targetIds,
    (data ?? []) as VisibleReactionRow[],
    currentUserId,
  )
}

export const mapViewCommentRows = (rows?: ViewCommentRow[] | null): Blip[] =>
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
    allow_comments: row.allow_comments ?? true,
    tags: [],
    updates_count: 0,
    reactions_count: 0,
    my_reaction_count: 0,
    reactions: [],
    author: mapAuthor(row.author),
  }))

export const mapViewUpdateRows = (rows?: ViewUpdateRow[] | null): ThreadedBlip[] =>
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
    allow_comments: row.allow_comments ?? true,
    tags: mapTagNames(row.tags),
    updates_count: row.updates_count ?? 0,
    reactions_count: row.reactions_count ?? 0,
    my_reaction_count: row.my_reaction_count ?? 0,
    reactions: mapReactionSummaries(row.reactions),
    comments: mapViewCommentRows(row.comments),
  }))

const isRootBlip = (blip: Pick<Blip, "parent_id" | "blip_type">) =>
  blip.parent_id === null && blip.blip_type === BLIP_TYPES.ROOT

const isJsonFilterSyntaxError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "22P02" &&
  "message" in error &&
  String((error as { message?: unknown }).message).includes(
    "invalid input syntax for type json",
  )

export const getBlips = query(async (limit: number = 20, offset: number = 0) => {
  "use server"

  return withQueryMetrics(
    "getBlips",
    { limit, offset },
    async () => {
      const { getServerClient } = await import("@/lib/vendor/supabase/server")
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
      const { getServerClient } = await import("@/lib/vendor/supabase/server")
      const supabase = await getServerClient()

      const { data: directData, error: directError } = await supabase
        .from("view_blips")
        .select(VIEW_BLIPS_SELECT)
        // `tags` on `view_blips` is jsonb of objects ({ id, name, description }).
        // Query directly in SQL first for efficient paging.
        .filter("tags", "cs", JSON.stringify([{ name: tag }]))
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (!directError) {
        return ((directData ?? []) as unknown as ViewBlipRow[]).map(mapViewBlipRow)
      }

      if (!isJsonFilterSyntaxError(directError)) {
        throw directError
      }

      const normalizedTag = tag.trim().toLowerCase()
      const pageSize = Math.max(limit, 50)
      let rangeStart = 0
      let matchedSeen = 0
      const collected: Blip[] = []

      // Fallback path when the gateway cannot parse jsonb filter syntax.
      while (collected.length < limit) {
        const { data, error } = await supabase
          .from("view_blips")
          .select(VIEW_BLIPS_SELECT)
          .order("created_at", { ascending: false })
          .range(rangeStart, rangeStart + pageSize - 1)

        if (error) {
          throw error
        }

        const rows = (data ?? []) as unknown as ViewBlipRow[]
        if (rows.length === 0) {
          break
        }

        for (const row of rows) {
          const tagNames = mapTagNames(row.tags).map(value => value.toLowerCase())
          if (!tagNames.includes(normalizedTag)) {
            continue
          }

          if (matchedSeen < offset) {
            matchedSeen += 1
            continue
          }

          collected.push(mapViewBlipRow(row))
          if (collected.length >= limit) {
            break
          }
        }

        if (rows.length < pageSize) {
          break
        }

        rangeStart += rows.length
      }

      return collected
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
      const { getServerClient } = await import("@/lib/vendor/supabase/server")
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
      const { getServerClient } = await import("@/lib/vendor/supabase/server")
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
        blip: {
          ...root,
          comments: mapViewCommentRows((data as unknown as ViewBlipRow).comments),
        },
        updates: mapViewUpdateRows((data as unknown as ViewBlipRow).updates),
      }
    },
    result => ({
      found: result !== null,
      updatesCount: result?.updates.length ?? 0,
    }),
  )
}, "blip-graph")

