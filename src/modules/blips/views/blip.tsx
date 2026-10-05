import {
  A,
  createAsync,
  revalidate,
  useLocation,
  useNavigate,
  useParams,
} from "@solidjs/router"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
  untrack,
} from "solid-js"
import { getRequestEvent, isServer } from "solid-js/web"
import { Seo } from "@/components/seo"
import { JsonLd, createBlogPostingSchema } from "@/components/json-ld"
import { deriveBlipTitle, deriveBlipDescription, formatPageTitle } from "@/modules/blips/seo"
import { Hashtag, Icon } from "@/components/icon"
import { Button } from "@/components/button"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { useNotify } from "@/components/notification"
import { Tooltip } from "@/components/tooltip"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { BlipCommentListItem } from "@/modules/blips/components/blip-comment-thread"
import { BlipCommentTrigger } from "@/modules/blips/components/blip-comment-trigger"
import { BlipReactionSummary } from "@/modules/blips/components/blip-reaction-summary"
import { BlipReactionTrigger } from "@/modules/blips/components/blip-reaction-trigger"
import { RequiresAdmin } from "@/modules/auth/components/requires-role"
import { REACTION_ERROR_I18N_KEY } from "@/modules/blips/data/errors"
import {
  BLIP_TYPES,
  blipStore,
  getBlipGraph,
  getTagCovers,
  tagStore,
  type Blip,
} from "@/modules/blips/data"
import {
  buildOptimisticReactionState,
  createReactionStateOverride,
  getReactionSignature,
  type ReactionStateOverride,
} from "@/modules/blips/data/reaction-optimistic"
import { reactionStore } from "@/modules/blips/data/reactions-store"
import { UpdateBlip } from "@/modules/blips/components/update-blip"
import { resolveTagCoverUrl } from "@/modules/tags/cover"
import { BlipMediaGallery, Lightbox } from "@/modules/media"
import {
  flattenBlipPageMedia,
  findMediaIndex,
  getBlipMediaFor,
  withLightboxGuest,
  groupMediaByBlipId,
} from "@/modules/media/data/queries"
import { findAudioEmbedRegions, parseAudioEmbedObjectLiteral, coerceAudioPlayerProps } from "@/components/markdown/audio/audio-embed-syntax"
import type { BlipMediaRow } from "@/modules/media/data/queries"
import { MediaVariant, variantUrl, originalUrl } from "@/modules/media/media-utils"
import { useBlipComposer } from "@/modules/blips/context/blip-composer-context"
import {
  formatBlipScheduledTimestamp,
  formatBlipTimestamp,
  formatBlipTimestampTooltip,
  getBlipPublishTimestamp,
  isBlipPubliclyVisible,
  isComposerFkStubUpdate,
  isUpdateActivityVisible,
  isBlipScheduled,
} from "@/modules/blips/util"
import {
  buildTopLevelActivity,
  type TopLevelSortDirection,
} from "@/modules/blips/views/blip-detail-ordering"
import { ptr } from "@/i18n"
import { blipPath, pages } from "@/urls"
import { resolveBlipSlugRedirect } from "@/modules/blips/slug"
import { clsx as cx } from "@/util"
import { withWindow } from "@/util/browser"
import "./blip.css"

const tr = ptr("blips.views.detail")
const commentThreadTr = ptr("blips.components.commentThread")

// Extract first audio embed coverImage from content (for og:image fallback)
function extractFirstAudioCoverImage(content: string | null | undefined): {
  coverImage: string
  title?: string
  width?: number
  height?: number
} | null {
  if (!content) return null
  
  const regions = findAudioEmbedRegions(content)
  for (const region of regions) {
    const objectLiteral = parseAudioEmbedObjectLiteral(region.block.objectLiteral)
    if (!objectLiteral) continue
    
    const props = coerceAudioPlayerProps(objectLiteral)
    if (!props?.coverImage) continue
    
    // Only accept absolute http(s) URLs
    if (!props.coverImage.startsWith('http://') && !props.coverImage.startsWith('https://')) {
      continue
    }
    
    return {
      coverImage: props.coverImage,
      title: props.title,
      width: typeof objectLiteral.width === 'number' ? objectLiteral.width : undefined,
      height: typeof objectLiteral.height === 'number' ? objectLiteral.height : undefined,
    }
  }
  
  return null
}

export function BlipView() {
  const REALTIME_UPDATE_HIGHLIGHT_MS = 60_000
  let updateInlineMountElement: HTMLDivElement | null = null
  let lastSeededBlipId: string | null = null
  let lastSeededUpdatesForBlipId: string | null = null
  let lastReactionViewerKey: string | null = null
  let lastReactionViewer = {
    id: null,
    status: null,
    displayName: null,
  } as const
  let reactionViewerBaselineCaptured = false
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const notify = useNotify()
  const {
    activeKind,
    closeActive,
    isUpdateOpenFor,
    openEditRoot,
    openEditUpdate,
    openNewComment,
    openNewUpdate,
    registerCommentInlineMount,
    registerUpdateInlineMount,
    requestCloseActive,
  } = useBlipComposer()
  const store = blipStore(supabase.client, { subscribe: false })
  const reactions = reactionStore(supabase.client, { subscribe: false })
  const tags = tagStore(supabase.client)
  const { isAuthenticated, isAdmin, userProfile, userSystem, loading } =
    useAuth() as any
  const commentVisibilityViewerKey = createMemo(() =>
    loading()
      ? "__loading__"
      : [
          userProfile()?.id ?? "__anon__",
          userSystem()?.status ?? "",
          isAdmin() ? "admin" : "standard",
        ].join(":"),
  )
  const blipGraphQuery = createAsync(() =>
    getBlipGraph(params.id, commentVisibilityViewerKey()),
  )
  // `.latest` rather than calling the accessor. Both read identically until the
  // query first resolves — on the server and on a cold load they still suspend,
  // which async SSR for this route depends on — but afterwards `.latest` keeps
  // serving the last good value instead of suspending again on every refetch.
  // The accessor form took the whole page down: the only Suspense boundary in
  // the app is the root one in `app.tsx`, and its fallback is `null`.
  const blipQuery = createMemo(() => blipGraphQuery.latest?.blip ?? null)
  const initialUpdates = createMemo(() => blipGraphQuery.latest?.updates ?? [])
  const initialRootComments = createMemo(
    () => blipGraphQuery.latest?.blip.comments ?? [],
  )
  const initialUpdateComments = createMemo(() =>
    (blipGraphQuery.latest?.updates ?? []).flatMap(
      update => update.comments ?? [],
    ),
  )
  const blip = createMemo(() => {
    const fromStore = store.getById(params.id)
    return fromStore ?? blipQuery() ?? null
  })

  // Set 404 status during SSR when blip is definitively not found
  // Only set 404 if query has resolved (not undefined) AND result is null
  // blipGraphQuery.latest returns undefined while loading, then the result or null
  const query = blipGraphQuery.latest
  if (query !== undefined && query === null) {
    const event = getRequestEvent()
    if (event && event.response) {
      event.response.status = 404
    }
  }

  // `/blips/{id}/{slug}`: a slug that isn't the blip's current slug (stale,
  // mistyped, wrong case) permanently redirects to the canonical URL. Plain
  // `/blips/{id}` is served as-is; its canonical link points at the slug URL.
  // Only compare against the graph for *this* id: `.latest` keeps serving
  // the previous blip while a client-side navigation refetches.
  const slugRedirectTarget = createMemo(() => {
    const graphBlip = blipGraphQuery.latest?.blip
    return graphBlip && graphBlip.id === params.id
      ? resolveBlipSlugRedirect(params.slug, graphBlip)
      : null
  })
  const ssrSlugRedirectTarget = isServer
    ? resolveBlipSlugRedirect(
        params.slug,
        query?.blip.id === params.id ? query.blip : null,
      )
    : null
  if (ssrSlugRedirectTarget) {
    const event = getRequestEvent()
    if (event && event.response) {
      event.response.status = 301
      event.response.headers.set("Location", ssrSlugRedirectTarget)
    }
  }
  createEffect(() => {
    const target = slugRedirectTarget()
    if (target && !isServer) {
      navigate(target, { replace: true, scroll: false, state: location.state })
    }
  })

  const [recentRealtimeUpdateStates, setRecentRealtimeUpdateStates] =
    createSignal<Record<string, { shimmering: boolean }>>({})
  const [hydratedRootTags, setHydratedRootTags] = createSignal<string[]>([])
  const [hasSeededInitialUpdates, setHasSeededInitialUpdates] =
    createSignal(false)
  const [hasSeededInitialComments, setHasSeededInitialComments] =
    createSignal(false)
  const [isReactionBusy, setIsReactionBusy] = createSignal(false)
  const [topLevelSortDirection, setTopLevelSortDirection] =
    createSignal<TopLevelSortDirection>("desc")
  const [reactionStateOverride, setReactionStateOverride] =
    createSignal<ReactionStateOverride | null>(null)
  const realtimeUpdateHighlightTimeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()
  const canManageUpdates = createMemo(() => {
    return isAuthenticated() && isAdmin()
  })
  const detailContainerWidthClass = createMemo(() => {
    const contentLength = (blip()?.content ?? "").trim().length

    // Keep width presets coarse and predictable:
    // short notes stay compact, medium notes get comfortable reading width,
    // and long-form notes can use the full detail width.
    if (contentLength < 360) {
      return "s"
    }
    if (contentLength < 1400) {
      return "m"
    }
    return "l"
  })

  const getUpdatesForRoot = (rootBlipId?: string | null) => {
    if (!rootBlipId) {
      return []
    }

    const cachedUpdates = store.updatesByParent(rootBlipId)
    if (hasSeededInitialUpdates()) {
      return cachedUpdates
    }

    if (cachedUpdates.length > 0) {
      return cachedUpdates
    }

    return initialUpdates()
  }
  const updates = createMemo(() => getUpdatesForRoot(blip()?.id))
  const blipTitle = createMemo(() => {
    const content = blip()?.content ?? ""
    return content ? deriveBlipTitle(content) : "Blip"
  })
  const blipDescription = createMemo(() => {
    const content = blip()?.content ?? ""
    return content ? deriveBlipDescription(content) : ""
  })
  const seoTitle = createMemo(() => formatPageTitle(blipTitle()))
  
  // SSR-safe media fetch for og:image (root + published updates)
  // Fetches graph independently to avoid race conditions with blipGraphQuery
  const seoMediaQuery = createAsync(async () => {
    // Fetch graph to get update IDs (uses cached result if available)
    const graph = await getBlipGraph(params.id)
    if (!graph) {
      return []
    }
    
    // Get published update IDs (only public updates for og:image)
    const publishedUpdateIds = (graph.updates ?? [])
      .filter(update => update.published)
      .map(update => update.id)
    
    // Fetch media for root + published updates
    const blipIds = [params.id, ...publishedUpdateIds]
    const media = await getBlipMediaFor(blipIds)
    return media
  })
  
  // SSR-safe tag cover lookup for the og:image fallback. Resolves to {} on any
  // error (including before the tags.cover_image migration is applied).
  const seoTagCoversQuery = createAsync(async () => {
    const graph = await getBlipGraph(params.id)
    const tagNames = graph?.blip.tags ?? []
    return tagNames.length > 0 ? getTagCovers(tagNames) : {}
  })
  
  // Choose og:image source in correct priority order
  const seoImageSource = createMemo((): 
    | { kind: 'media'; row: BlipMediaRow }
    | { kind: 'audio'; cover: { coverImage: string; title?: string; width?: number; height?: number } }
    | { kind: 'tag'; coverImage: string; tagName: string }
    | null => {
    const allMedia = seoMediaQuery.latest ?? []
    const mediaByBlip = groupMediaByBlipId(allMedia)
    const graph = blipGraphQuery.latest
    
    // (1) Root blip_media
    const rootMedia = mediaByBlip[params.id] ?? []
    if (rootMedia.length > 0) {
      return { kind: 'media', row: rootMedia[0] }
    }
    
    // (2) Root blip audio coverImage
    const rootBlip = blipQuery()
    if (rootBlip?.content) {
      const audioCover = extractFirstAudioCoverImage(rootBlip.content)
      if (audioCover) {
        return { kind: 'audio', cover: audioCover }
      }
    }
    
    // (3) For each published update in page order: media, else audio coverImage
    if (graph) {
      const publishedUpdates = (graph.updates ?? [])
        .filter(update => update.published)
      
      for (const update of publishedUpdates) {
        // Check update's media first
        const updateMedia = mediaByBlip[update.id] ?? []
        if (updateMedia.length > 0) {
          return { kind: 'media', row: updateMedia[0] }
        }
        
        // Then check update's audio coverImage
        if (update.content) {
          const audioCover = extractFirstAudioCoverImage(update.content)
          if (audioCover) {
            return { kind: 'audio', cover: audioCover }
          }
        }
      }
    }
    
    // (4) First root tag (alphabetical, the display order) with a cover image
    const covers = seoTagCoversQuery.latest ?? {}
    for (const tagName of rootBlip?.tags ?? []) {
      const coverImage = resolveTagCoverUrl(covers[tagName])
      if (coverImage) {
        return { kind: 'tag', coverImage, tagName }
      }
    }
    
    // (5) No source found
    return null
  })
  
  const ogImageUrl = createMemo(() => {
    const source = seoImageSource()
    
    if (!source) {
      return "/og-image.jpg"
    }
    
    if (source.kind === 'media') {
      const { row } = source
      const storageKey = row.storage_key
      const mimeType = row.mime_type
      const processingStatus = row.processing_status

      // Videos and GIFs use Thumb variant
      if (mimeType.startsWith("video/") || mimeType === "image/gif") {
        return variantUrl(storageKey, MediaVariant.Thumb)
      }

      // Other images use Large variant when complete, else original
      if (mimeType.startsWith("image/")) {
        if (processingStatus === "complete") {
          return variantUrl(storageKey, MediaVariant.Large)
        }
        return originalUrl(storageKey, mimeType)
      }
    }
    
    if (source.kind === 'audio') {
      return source.cover.coverImage
    }
    
    if (source.kind === 'tag') {
      return source.coverImage
    }

    return "/og-image.jpg"
  })

  const ogImageDimensions = createMemo(() => {
    const source = seoImageSource()
    
    if (!source) {
      return { width: 1200, height: 630 }
    }
    
    if (source.kind === 'media') {
      const { row } = source
      const width = row.width
      const height = row.height

      if (width != null && height != null && width > 0 && height > 0) {
        return { width, height }
      }
      return null
    }
    
    if (source.kind === 'audio') {
      const { cover } = source
      const width = cover.width
      const height = cover.height
      if (width != null && height != null && width > 0 && height > 0) {
        return { width, height }
      }
      return null
    }
    
    return { width: 1200, height: 630 }
  })
  
  const ogImageAlt = createMemo(() => {
    const source = seoImageSource()
    
    if (!source) {
      return undefined
    }
    
    if (source.kind === 'media') {
      return source.row.media_type === "image" ? blipTitle() : undefined
    }
    
    if (source.kind === 'audio' && source.cover.title) {
      return source.cover.title
    }
    
    if (source.kind === 'tag') {
      return `${source.tagName} tag cover`
    }
    
    return undefined
  })
  const canonicalPath = createMemo(() => {
    const slugFor = (candidate: Blip | null | undefined) =>
      candidate?.id === params.id ? candidate.slug : undefined
    return blipPath({
      id: params.id,
      slug: slugFor(blip()) ?? slugFor(blipQuery()) ?? null,
    })
  })
  const publishedTime = createMemo(() => {
    const currentBlip = blip()
    if (!currentBlip) {
      return undefined
    }
    const timestamp = getBlipPublishTimestamp(currentBlip)
    return new Date(timestamp).toISOString()
  })
  const modifiedTime = createMemo(() => {
    const currentBlip = blip()
    if (!currentBlip?.updated_at) {
      return undefined
    }
    return new Date(currentBlip.updated_at).toISOString()
  })
  const visibleRootTags = createMemo(() => {
    const rootBlip = blip()
    if (!rootBlip) {
      return []
    }

    if ((rootBlip.tags?.length ?? 0) > 0) {
      return rootBlip.tags ?? []
    }

    return hydratedRootTags()
  })
  const blipTags = createMemo(() => visibleRootTags())
  
  const ogUrl = createMemo(() => {
    const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)
      ?.trim()
      .replace(/\/+$/, "")
    if (!siteUrl) {
      return ""
    }

    return `${siteUrl}${canonicalPath()}`
  })
  const visibleUpdates = createMemo(() => {
    const allUpdates = updates().filter(update =>
      isUpdateActivityVisible(update),
    )
    if (isAuthenticated()) {
      return allUpdates
    }
    return allUpdates.filter(update => isBlipPubliclyVisible(update))
  })
  const rootTimestampDisplay = createMemo(() => {
    const currentBlip = blip()
    if (!currentBlip) {
      return null
    }

    const publishAt = getBlipPublishTimestamp(currentBlip)
    const scheduled = isBlipScheduled(currentBlip)

    return {
      scheduled,
      label: scheduled
        ? formatBlipScheduledTimestamp(publishAt)
        : formatBlipTimestamp(publishAt),
      tooltip: formatBlipTimestampTooltip(currentBlip, fullTimestamp =>
        tr("labels.scheduledTooltip", { timestamp: fullTimestamp }),
      ),
    }
  })
  const initialCommentsByParentId = createMemo(() => {
    const next = new Map<string, Blip[]>()
    for (const comment of [
      ...initialRootComments(),
      ...initialUpdateComments(),
    ]) {
      if (!comment.parent_id) {
        continue
      }

      const existing = next.get(comment.parent_id) ?? []
      next.set(comment.parent_id, [...existing, comment])
    }
    return next
  })
  const getCommentsForParent = (parentId?: string | null) => {
    if (!parentId) {
      return []
    }

    const cachedComments = store.commentsByParent(parentId)
    if (hasSeededInitialComments()) {
      return cachedComments
    }

    if (cachedComments.length > 0) {
      return cachedComments
    }

    return initialCommentsByParentId().get(parentId) ?? []
  }
  const rootComments = createMemo(() => getCommentsForParent(blip()?.id))
  const visibleCommentCount = createMemo(() => {
    // oxlint-disable-next-line solid/reactivity
    const updateCommentCount = visibleUpdates().reduce((total, update) => {
      return total + getCommentsForParent(update.id).length
    }, 0)

    return rootComments().length + updateCommentCount
  })
  const hasTopLevelActivity = createMemo(
    () => visibleUpdates().length > 0 || rootComments().length > 0,
  )
  const topLevelActivity = createMemo(() =>
    buildTopLevelActivity({
      updates: visibleUpdates(),
      rootComments: rootComments(),
      direction: topLevelSortDirection(),
    }),
  )
  // `buildTopLevelActivity` returns fresh wrapper objects on every recompute,
  // and the updates themselves swap identity once the store seeds (graph rows →
  // cached copies). `<For>` keys by reference, so iterating those objects
  // re-created every <UpdateBlip> — and its gallery thumbnails — whenever any
  // input changed, which flickered every tile during load. Iterate stable
  // string keys instead and look the current item up by key.
  const topLevelActivityByKey = createMemo(
    () =>
      new Map(
        topLevelActivity().map(item => [
          `${item.kind}:${item.blip.id}`,
          item,
        ]),
      ),
  )
  const topLevelActivityKeys = createMemo(
    () => [...topLevelActivityByKey().keys()],
    undefined,
    {
      equals: (previous, next) =>
        previous.length === next.length &&
        previous.every((key, index) => key === next[index]),
    },
  )
  const topLevelSortTooltip = createMemo(() =>
    topLevelSortDirection() === "desc"
      ? tr("sort.toggleToOldest")
      : tr("sort.toggleToNewest"),
  )
  const showComposer = createMemo(() => isUpdateOpenFor(blip()?.id))
  const showActivityMetaRow = createMemo(
    () =>
      visibleUpdates().length > 0 ||
      canManageUpdates() ||
      showComposer() ||
      rootComments().length > 0,
  )
  const visibleUpdateIds = createMemo(() =>
    visibleUpdates().map(update => update.id),
  )
  // Phase 6 reader media: load the root blip + its visible updates' committed
  // `blip_media` in one batched round trip (handoff fork 1 → dedicated query).
  const mediaBlipIds = createMemo(() => {
    const rootId = blip()?.id
    if (!rootId) {
      return [] as string[]
    }
    return [rootId, ...visibleUpdateIds()]
  })
  const blipMediaQuery = createAsync(() => {
    const ids = mediaBlipIds()
    return ids.length > 0 ? getBlipMediaFor(ids) : Promise.resolve([])
  })
  // Read via `.latest` for the reason above, and most of all here: publishing an
  // update adds it to the store, which grows `mediaBlipIds` and refetches. That
  // is an ordinary signal change with no `startTransition` around it to hold the
  // rendered page, so suspending here blanked the entire screen right after a
  // save and stayed blank for as long as the request took — or forever, if it
  // never came back.
  const mediaByBlip = createMemo(() =>
    groupMediaByBlipId(blipMediaQuery.latest ?? []),
  )
  const rootMedia = createMemo(() => mediaByBlip()[blip()?.id ?? ""] ?? [])
  const galleryLabels = {
    region: tr("media.region"),
    close: tr("media.close"),
    previous: tr("media.previous"),
    next: tr("media.next"),
    counter: (current: number, total: number) =>
      tr("media.counter", { current, total }),
    openItem: (index: number, total: number) =>
      tr("media.openItem", { index, total }),
  }
  const updateIdsInPageOrder = createMemo(() =>
    topLevelActivity()
      .filter(item => item.kind === "update")
      .map(item => item.blip.id),
  )
  const pageMedia = createMemo(() =>
    flattenBlipPageMedia(rootMedia(), mediaByBlip(), updateIdsInPageOrder()),
  )
  const [lightboxIndex, setLightboxIndex] = createSignal<number | null>(null)
  const [lightboxGuest, setLightboxGuest] = createSignal<BlipMediaRow | null>(
    null,
  )
  const lightboxMedia = createMemo(() =>
    withLightboxGuest(pageMedia(), lightboxGuest()),
  )
  const closeLightbox = () => {
    setLightboxIndex(null)
    setLightboxGuest(null)
  }
  const openPageMediaItem = (record: BlipMediaRow) => {
    const list = pageMedia()
    const index = findMediaIndex(list, record)
    if (index >= 0) {
      setLightboxGuest(null)
      setLightboxIndex(index)
      return
    }
    setLightboxGuest(record)
    setLightboxIndex(list.length)
  }
  const pageMediaOpenItemLabel = (record: BlipMediaRow) => {
    const items = lightboxMedia()
    const index = findMediaIndex(items, record)
    if (index < 0) {
      return ""
    }
    return galleryLabels.openItem(index + 1, items.length)
  }

  // Reader media comes from a cached server query; refresh it when the author
  // closes a composer or finishes persisting new attachments.
  createEffect(
    on(activeKind, (kind, previousKind) => {
      if (previousKind && !kind) {
        revalidate(getBlipMediaFor.key)
      }
    }),
  )

  createEffect(() => {
    void params.id
    closeLightbox()
  })
  const visibleCommentIds = createMemo(() => {
    const nextIds = new Set<string>()

    for (const comment of rootComments()) {
      nextIds.add(comment.id)
    }

    for (const update of visibleUpdates()) {
      for (const comment of getCommentsForParent(update.id)) {
        nextIds.add(comment.id)
      }
    }

    return [...nextIds]
  })
  const watchUpdatesRootId = createMemo(() => {
    const rootBlip = blip()
    if (!rootBlip || rootBlip.blip_type !== BLIP_TYPES.ROOT) {
      return ""
    }

    return rootBlip.id
  })
  const reactionWatchKey = createMemo(() => {
    if (showComposer()) {
      return ""
    }

    const rootId = watchUpdatesRootId()
    if (!rootId) {
      return ""
    }

    return [rootId, ...visibleUpdateIds(), ...visibleCommentIds()].join("|")
  })
  const reactionSignature = createMemo(() =>
    getReactionSignature(blip()?.reactions ?? []),
  )
  const displayBlip = createMemo(() => {
    const base = blip()
    const override = reactionStateOverride()
    if (!base || !override) {
      return base
    }

    return {
      ...base,
      reactions: override.reactions,
      my_reaction_count: override.my_reaction_count,
      reactions_count: override.reactions_count,
    }
  })

  const markRealtimeUpdateAsRecent = (updateId: string) => {
    const existingHighlightTimeout =
      realtimeUpdateHighlightTimeouts.get(updateId)
    if (existingHighlightTimeout) {
      clearTimeout(existingHighlightTimeout)
    }

    setRecentRealtimeUpdateStates(current => ({
      ...current,
      [updateId]: { shimmering: true },
    }))

    const highlightTimeout = setTimeout(() => {
      setRecentRealtimeUpdateStates(current => {
        if (!current[updateId]) {
          return current
        }
        const next = { ...current }
        delete next[updateId]
        return next
      })
      realtimeUpdateHighlightTimeouts.delete(updateId)
    }, REALTIME_UPDATE_HIGHLIGHT_MS)
    realtimeUpdateHighlightTimeouts.set(updateId, highlightTimeout)
  }

  const handleBackToBlips = (event: MouseEvent) => {
    event.preventDefault()
    const fromBlips = (location.state as any)?.fromBlips

    if (fromBlips) {
      withWindow((window: Window) => {
        window.history.back()
      })
      return
    }

    navigate(pages.blips, {
      replace: true,
    })
  }

  createEffect(() => {
    const loaded = blipQuery()
    if (!loaded || lastSeededBlipId === loaded.id) {
      return
    }

    lastSeededBlipId = loaded.id
    void store.upsert(loaded, { cacheOnly: true })
  })

  createEffect(() => {
    const loaded = initialUpdates()
    const rootBlipId = blipQuery()?.id ?? null
    if (!rootBlipId) {
      return
    }

    if (loaded.length === 0) {
      setHasSeededInitialUpdates(true)
      return
    }

    if (lastSeededUpdatesForBlipId === rootBlipId) {
      setHasSeededInitialUpdates(true)
      return
    }

    lastSeededUpdatesForBlipId = rootBlipId
    untrack(() => {
      store.mergeIntoCache(loaded)
    })
    setHasSeededInitialUpdates(true)
  })

  createEffect(() => {
    void params.id
    setHasSeededInitialUpdates(false)
    setHasSeededInitialComments(false)
  })

  createEffect(() => {
    const loadedComments = [
      ...initialRootComments(),
      ...initialUpdateComments(),
    ]
    const targetParentIds = [
      blipQuery()?.id,
      ...initialUpdates().map(update => update.id),
    ].filter((parentId): parentId is string => Boolean(parentId))

    if (targetParentIds.length === 0) {
      setHasSeededInitialComments(true)
      return
    }

    untrack(() => {
      store.replaceCommentsForParents(targetParentIds, loadedComments)
    })
    setHasSeededInitialComments(true)
  })

  createEffect(() => {
    const rootBlip = blip()
    if (!rootBlip || !isAuthenticated() || rootBlip.published) {
      setHydratedRootTags([])
      return
    }
    if (rootBlip.tags !== undefined) {
      return
    }

    void (async () => {
      const result = await tags.getBlipTagValues(rootBlip.id)
      if (result.error || !result.data) {
        return
      }
      if (blip()?.id !== rootBlip.id) {
        return
      }
      setHydratedRootTags(result.data)
    })()
  })

  createEffect(() => {
    const currentBlip = blip()
    if (!currentBlip) {
      return
    }

    void currentBlip.id
    void currentBlip.my_reaction_count
    void currentBlip.reactions_count
    void reactionSignature()
    setReactionStateOverride(null)
  })

  createEffect(() => {
    if (!canManageUpdates() && showComposer()) {
      closeActive()
    }
  })

  createEffect(() => {
    const rootBlipId = watchUpdatesRootId()
    if (!rootBlipId) {
      return
    }

    const unsubscribe = store.watchUpdates(rootBlipId, {
      shouldCacheIncoming: incoming => {
        if (!isUpdateOpenFor(rootBlipId)) {
          return true
        }

        return !isComposerFkStubUpdate(incoming)
      },
      onInsert: incoming => {
        if (isUpdateOpenFor(rootBlipId) && isComposerFkStubUpdate(incoming)) {
          return
        }

        markRealtimeUpdateAsRecent(incoming.id)
      },
      onUpdate: incoming => {
        if (isUpdateOpenFor(rootBlipId)) {
          return
        }

        markRealtimeUpdateAsRecent(incoming.id)
      },
    })

    onCleanup(unsubscribe)
  })

  createEffect(() => {
    const rootBlipId = watchUpdatesRootId()
    if (!rootBlipId) {
      return
    }

    const unsubscribe = store.watchBlips([rootBlipId], {
      onUpdate: incoming => {
        if (incoming.blip_type !== BLIP_TYPES.ROOT) {
          return
        }

        void store.refreshReactionState(incoming.id)
      },
    })

    onCleanup(unsubscribe)
  })

  createEffect(() => {
    const watchKey = reactionWatchKey()
    if (!watchKey) {
      return
    }

    const reactionBlipIds = watchKey.split("|")
    void store.refreshReactionStates(reactionBlipIds)
    const unsubscribe = store.watchReactions(reactionBlipIds)
    onCleanup(unsubscribe)
  })

  createEffect(() => {
    const rootId = watchUpdatesRootId()
    if (!rootId) {
      return
    }

    const unsubscribe = store.watchComments([rootId, ...visibleUpdateIds()])
    onCleanup(unsubscribe)
  })

  createEffect(() => {
    if (loading()) {
      return
    }

    if (showComposer()) {
      return
    }

    const nextViewer = {
      id: userProfile()?.id ?? null,
      status: userSystem()?.status ?? null,
      displayName: userProfile()?.displayName ?? null,
    }
    const rootBlip = untrack(() => blip())
    const nextViewerKey = [
      nextViewer.id ?? "__anon__",
      nextViewer.status ?? "",
      nextViewer.displayName ?? "",
      rootBlip?.id ?? "",
    ].join(":")

    if (!reactionViewerBaselineCaptured) {
      reactionViewerBaselineCaptured = true
      lastReactionViewerKey = nextViewerKey
      lastReactionViewer = nextViewer
      return
    }

    if (lastReactionViewerKey === nextViewerKey) {
      return
    }
    lastReactionViewerKey = nextViewerKey

    if (!rootBlip || rootBlip.blip_type !== BLIP_TYPES.ROOT) {
      lastReactionViewer = nextViewer
      return
    }

    const reactionBlipIds = untrack(() => [
      rootBlip.id,
      ...visibleUpdateIds(),
      ...visibleCommentIds(),
    ])
    void store.syncReactionViewer(
      reactionBlipIds,
      nextViewer,
      lastReactionViewer,
    )
    lastReactionViewer = nextViewer
  })

  createEffect(() => {
    const activeIds = new Set(updates().map(update => update.id))

    for (const [id, timeoutId] of realtimeUpdateHighlightTimeouts.entries()) {
      if (!activeIds.has(id)) {
        clearTimeout(timeoutId)
        realtimeUpdateHighlightTimeouts.delete(id)
      }
    }

    setRecentRealtimeUpdateStates(current => {
      const nextEntries = Object.entries(current).filter(([id]) =>
        activeIds.has(id),
      )

      if (nextEntries.length === Object.keys(current).length) {
        return current
      }

      return Object.fromEntries(nextEntries)
    })
  })

  onCleanup(() => {
    for (const timeoutId of realtimeUpdateHighlightTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    realtimeUpdateHighlightTimeouts.clear()
    if (updateInlineMountElement) {
      registerUpdateInlineMount(params.id, null)
      updateInlineMountElement = null
    }
    if (isUpdateOpenFor(params.id)) {
      closeActive()
    }
  })

  const handleEditRootBlip = async (rootBlipId: string) => {
    const currentRootBlip = blip()
    if (currentRootBlip?.id === rootBlipId) {
      // Seed the shared blip store so the shared root editor can resolve requested blipId.
      await store.upsert(currentRootBlip, { cacheOnly: true })
    }

    openEditRoot(rootBlipId)
  }

  const handleEditUpdate = (updateBlipId: string) => {
    const rootBlipId = blip()?.id
    if (!rootBlipId) {
      return
    }

    openEditUpdate(rootBlipId, updateBlipId)
  }

  // Set 404 status when blip is not found
  createEffect(() => {
    const query = blipQuery()
    if (query === null) {
      const event = getRequestEvent()
      if (event && event.response) {
        event.response.status = 404
      }
    }
  })

  const handleToggleReaction = async (emoji: string) => {
    const currentBlip = displayBlip()
    if (!currentBlip || isReactionBusy()) {
      return
    }

    const previousReactions = currentBlip.reactions ?? []
    const previousCount = currentBlip.my_reaction_count ?? 0
    const hasActiveReaction =
      previousReactions.find(reaction => reaction.emoji === emoji)
        ?.reacted_by_current_user ?? false
    const optimisticOverride = buildOptimisticReactionState({
      reactions: previousReactions,
      myReactionCount: previousCount,
      emoji,
      nextActive: !hasActiveReaction,
      visitorDisplayName: userProfile()?.displayName ?? null,
    })
    const applyVisibleReactionState = (next: ReactionStateOverride) => {
      setReactionStateOverride(next)
      store.updateCachedReactionState(currentBlip.id, next)
    }

    setIsReactionBusy(true)
    applyVisibleReactionState(optimisticOverride)

    const result = await reactions.toggleReaction(currentBlip.id, emoji, {
      profileId: userProfile()?.id ?? null,
      status: userSystem()?.status ?? null,
      currentCount: previousCount,
      hasActiveReaction,
    })

    setIsReactionBusy(false)

    if (result.error || !result.data) {
      applyVisibleReactionState(
        createReactionStateOverride(previousReactions, previousCount),
      )
      const errorKey =
        REACTION_ERROR_I18N_KEY[result.error ?? "UNKNOWN"] ??
        REACTION_ERROR_I18N_KEY.UNKNOWN
      notify.error({ content: errorKey })
      return
    }

    applyVisibleReactionState({
      ...optimisticOverride,
      my_reaction_count: result.data.myReactionCount,
    })
  }

  return (
    <>
      <Show when={blip()}>
        <Seo
          title={seoTitle()}
          description={blipDescription()}
          path={canonicalPath()}
          type="article"
          image={ogImageUrl()}
          imageAlt={ogImageAlt()}
          imageWidth={ogImageDimensions()?.width}
          imageHeight={ogImageDimensions()?.height}
          publishedTime={publishedTime()}
          modifiedTime={modifiedTime()}
        />
      </Show>
      {/* BlogPosting JSON-LD renders client-side due to SolidJS SSR limitations with
          script tags in routes with async data dependencies. Google reads client-side 
          JSON-LD, so this is acceptable for SEO. Homepage JSON-LD renders in SSR. */}
      <Show when={blip()}>
        <JsonLd
          data={createBlogPostingSchema({
            headline: blipTitle(),
            datePublished: publishedTime() ?? new Date().toISOString(),
            dateModified: modifiedTime(),
            canonicalUrl: ogUrl(),
            image: ogImageUrl() && ogUrl() ? new URL(ogImageUrl(), ogUrl()).toString() : undefined,
            keywords: blipTags(),
          })}
        />
      </Show>
      <main>
        <section class="blip-detail-page">
          <div class={cx("blip-detail-container", detailContainerWidthClass())}>
            <a
              href={pages.blips}
              onClick={handleBackToBlips}
              class="blip-detail-back-link">
              <Icon name="arrow_back" />
              {tr("actions.backToBlips")}
            </a>
            <Show
              when={blip()}
              fallback={
                <p class="blip-detail-status">
                  {blipQuery() === undefined ? tr("loading") : tr("notFound")}
                </p>
              }>
              {data => (
                <>
                  <div class="blip-detail-body">
                    <article class="blip-detail-card">
                      <header
                        class="blip-detail-header"
                        classList={{
                          scheduled: rootTimestampDisplay()?.scheduled,
                        }}>
                        <Tooltip
                          content={() => rootTimestampDisplay()?.tooltip ?? ""}
                          touchMode="popover">
                          <span class="timestamp">
                            {rootTimestampDisplay()?.label ?? ""}
                            <Show when={rootTimestampDisplay()?.scheduled}>
                              <Icon
                                name="schedule"
                                class="icon"
                              />
                            </Show>
                          </span>
                        </Tooltip>
                      </header>
                      <div class="blip-detail-content">
                        <Markdown
                          content={data().content ?? ""}
                          media={rootMedia()}
                          onOpenMedia={openPageMediaItem}
                        />
                      </div>
                      <BlipMediaGallery
                        media={rootMedia()}
                        content={data().content ?? ""}
                        labels={galleryLabels}
                        class="blip-detail-media"
                        onOpenItem={openPageMediaItem}
                        getOpenItemLabel={pageMediaOpenItemLabel}
                      />
                      <footer class="blip-detail-footer">
                        <div class="blip-detail-footer-top-row">
                          <div class="tags">
                            <Show when={visibleRootTags().length > 0}>
                              <Hashtag />
                              <ul class="tag-list">
                                <For each={visibleRootTags()}>
                                  {tag => (
                                    <li class="tag">
                                      <A href={pages.blipsTag(tag)}>{tag}</A>
                                    </li>
                                  )}
                                </For>
                              </ul>
                            </Show>
                          </div>
                          <BlipActions
                            blip={data()}
                            onEdit={handleEditRootBlip}
                            fullWidth={false}
                          />
                        </div>
                        <hr class="blip-detail-footer-separator" />
                        <div class="blip-detail-footer-bottom-row">
                          <div class="blip-detail-reactions">
                            <BlipReactionSummary
                              reactions={(displayBlip() ?? data()).reactions}
                              busy={isReactionBusy()}
                              onToggleReaction={
                                isAuthenticated()
                                  ? emoji => {
                                      void handleToggleReaction(emoji)
                                    }
                                  : undefined
                              }
                            />
                          </div>
                          <div class="activity">
                            <BlipReactionTrigger
                              blip={displayBlip() ?? data()}
                              triggerAriaLabel={tr("actions.addReaction")}
                              onReactionStateChange={next => {
                                const nextState = {
                                  reactions: next.reactions,
                                  my_reaction_count: next.myReactionCount,
                                  reactions_count: next.reactionsCount,
                                }
                                setReactionStateOverride(nextState)
                                store.updateCachedReactionState(
                                  data().id,
                                  nextState,
                                )
                              }}
                            />
                            <Show when={data().allow_comments !== false}>
                              <BlipCommentTrigger
                                onCompose={() => openNewComment(data().id)}
                              />
                            </Show>
                          </div>
                        </div>
                      </footer>
                    </article>
                    <div class="blip-detail-secondary-stack">
                      <div
                        class="inline-mount"
                        ref={element =>
                          registerCommentInlineMount(data().id, element)
                        }
                      />
                      <div class="thread-stack">
                        <div class="blip-detail-meta-row">
                          <div class="blip-detail-meta-row-start">
                            <Show when={showActivityMetaRow()}>
                              <div class="blip-detail-updates-group">
                                <Show when={visibleUpdates().length > 0}>
                                  <div class="blip-updates-chip">
                                    <span class="blip-updates-chip-label">
                                      {tr("updates.label")}
                                    </span>
                                    <span class="blip-updates-chip-count">
                                      {visibleUpdates().length}
                                    </span>
                                  </div>
                                </Show>
                                <RequiresAdmin>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    label={tr("updates.editor.newLabel")}
                                    iconRight="chat_add_on"
                                    class={cx("blip-detail-add-update", {
                                      active: showComposer(),
                                    })}
                                    aria-label={
                                      showComposer()
                                        ? tr("actions.hideUpdateComposer")
                                        : tr("actions.postUpdate")
                                    }
                                    onClick={() => {
                                      if (showComposer()) {
                                        requestCloseActive()
                                        return
                                      }

                                      const rootBlipId = blip()?.id
                                      if (!rootBlipId) {
                                        return
                                      }

                                      openNewUpdate(rootBlipId)
                                    }}
                                  />
                                </RequiresAdmin>
                              </div>
                            </Show>
                          </div>
                          <div class="blip-detail-meta-row-end">
                            <Show
                              when={data().allow_comments === false}
                              fallback={
                                <Show when={visibleCommentCount() > 0}>
                                  <div class="blip-comments-chip">
                                    <span class="blip-comments-chip-label">
                                      {commentThreadTr("title")}
                                    </span>
                                    <span class="blip-comments-chip-count">
                                      {visibleCommentCount()}
                                    </span>
                                  </div>
                                </Show>
                              }>
                              <Tooltip
                                content={commentThreadTr("disabled")}
                                triggerAs="span"
                                triggerClass="blip-comments-chip blip-comments-chip-disabled">
                                <span class="blip-comments-chip-label">
                                  {tr("actions.commentsDisabled")}
                                </span>
                                <span class="blip-comments-chip-lock">
                                  <Icon name="lock" />
                                </span>
                              </Tooltip>
                            </Show>
                            <Show when={hasTopLevelActivity()}>
                              <Tooltip
                                content={topLevelSortTooltip()}
                                triggerAs="button"
                                triggerClass={cx(
                                  "icon-button xs blip-detail-sort-toggle",
                                  {
                                    active: topLevelSortDirection() === "asc",
                                  },
                                )}
                                triggerProps={{
                                  type: "button",
                                  "aria-label": topLevelSortTooltip(),
                                  "data-direction": topLevelSortDirection(),
                                  onClick: () =>
                                    setTopLevelSortDirection(direction =>
                                      direction === "desc" ? "asc" : "desc",
                                    ),
                                }}>
                                <Icon
                                  name="list_arrow"
                                  class="blip-detail-sort-toggle-icon"
                                />
                              </Tooltip>
                            </Show>
                          </div>
                        </div>
                        <div
                          ref={element => {
                            updateInlineMountElement = element
                            registerUpdateInlineMount(params.id, element)
                          }}
                        />
                        <Show when={hasTopLevelActivity()}>
                          <section class="blip-activity-section">
                            <ul class="blip-detail-activity-list">
                              <For each={topLevelActivityKeys()}>
                                {key => {
                                  const activity = () =>
                                    topLevelActivityByKey().get(key)
                                  return (
                                    <Show when={activity()}>
                                      {current =>
                                        current().kind === "comment" ? (
                                          <BlipCommentListItem
                                            comment={current().blip}
                                            parentBlip={blip() ?? data()}
                                          />
                                        ) : (
                                          <UpdateBlip
                                            blip={current().blip}
                                            comments={getCommentsForParent(
                                              current().blip.id,
                                            )}
                                            media={
                                              mediaByBlip()[current().blip.id] ??
                                              []
                                            }
                                            mediaLabels={galleryLabels}
                                            onOpenMediaItem={openPageMediaItem}
                                            getMediaOpenItemLabel={
                                              pageMediaOpenItemLabel
                                            }
                                            onEdit={handleEditUpdate}
                                            isRecentRealtime={
                                              recentRealtimeUpdateStates()[
                                                current().blip.id
                                              ] !== undefined
                                            }
                                            isShimmering={
                                              recentRealtimeUpdateStates()[
                                                current().blip.id
                                              ]?.shimmering === true
                                            }
                                          />
                                        )
                                      }
                                    </Show>
                                  )
                                }}
                              </For>
                            </ul>
                          </section>
                        </Show>
                      </div>
                    </div>
                  </div>
                  <Show when={lightboxMedia().length > 0}>
                    <Lightbox
                      media={lightboxMedia()}
                      index={lightboxIndex()}
                      onClose={closeLightbox}
                      labels={galleryLabels}
                    />
                  </Show>
                </>
              )}
            </Show>
          </div>
        </section>
      </main>
    </>
  )
}
