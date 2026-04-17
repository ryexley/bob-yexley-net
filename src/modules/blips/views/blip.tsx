import {
  A,
  createAsync,
  useLocation,
  useNavigate,
  useParams,
} from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
} from "solid-js"
import { Hashtag, Icon } from "@/components/icon"
import { Button } from "@/components/button"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { useNotify } from "@/components/notification"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { BlipCommentTrigger } from "@/modules/blips/components/blip-comment-trigger"
import { BlipReactionSummary } from "@/modules/blips/components/blip-reaction-summary"
import { BlipReactionTrigger } from "@/modules/blips/components/blip-reaction-trigger"
import { REACTION_ERROR_I18N_KEY } from "@/modules/blips/data/errors"
import {
  BLIP_TYPES,
  blipStore,
  getBlipGraph,
  tagStore,
} from "@/modules/blips/data"
import {
  buildOptimisticReactionState,
  createReactionStateOverride,
  getReactionSignature,
  type ReactionStateOverride,
} from "@/modules/blips/data/reaction-optimistic"
import { reactionStore } from "@/modules/blips/data/reactions-store"
import { BlipCommentThread } from "@/modules/blips/components/blip-comment-thread"
import { UpdateBlip } from "@/modules/blips/components/update-blip"
import { useBlipComposer } from "@/modules/blips/context/blip-composer-context"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { clsx as cx } from "@/util"
import { windowTitle, withWindow } from "@/util/browser"
import "./blip.css"

const tr = ptr("blips.views.detail")
const commentThreadTr = ptr("blips.components.commentThread")
const MAX_SHARE_DESCRIPTION_LENGTH = 180
const MAX_SHARE_TITLE_LENGTH = 68

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim()

const stripMarkdownForMeta = (value: string) =>
  collapseWhitespace(
    value
      // Fenced code blocks.
      .replace(/```[\s\S]*?```/g, " ")
      // Inline code.
      .replace(/`([^`]+)`/g, "$1")
      // Images and links.
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      // Headings, blockquotes, lists, emphasis.
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^[*-+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/[*_=~]+/g, "")
      // Bare URLs.
      .replace(/https?:\/\/\S+/g, " "),
  )

const truncateForMeta = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value
  }

  const trimmed = value.slice(0, maxLength).trimEnd()
  const lastSpace = trimmed.lastIndexOf(" ")
  if (lastSpace < 40) {
    return `${trimmed}...`
  }

  return `${trimmed.slice(0, lastSpace)}...`
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
  const { isAuthenticated, isSuperuser, user, visitor, loading } = useAuth() as any
  const blipGraphQuery = createAsync(() => getBlipGraph(params.id))
  const blipQuery = createMemo(() => blipGraphQuery()?.blip ?? null)
  const initialUpdates = createMemo(() => blipGraphQuery()?.updates ?? [])
  const initialRootComments = createMemo(() => blipGraphQuery()?.blip.comments ?? [])
  const initialUpdateComments = createMemo(() =>
    (blipGraphQuery()?.updates ?? []).flatMap(update => update.comments ?? []),
  )
  const blip = createMemo(() => {
    const fromStore = store.getById(params.id)
    return fromStore ?? blipQuery() ?? null
  })
  const [recentRealtimeUpdateStates, setRecentRealtimeUpdateStates] =
    createSignal<Record<string, { shimmering: boolean }>>({})
  const [hydratedRootTags, setHydratedRootTags] = createSignal<string[]>([])
  const [isReactionBusy, setIsReactionBusy] = createSignal(false)
  const [reactionStateOverride, setReactionStateOverride] =
    createSignal<ReactionStateOverride | null>(null)
  const realtimeUpdateHighlightTimeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()
  const canManageUpdates = createMemo(() => {
    const rootBlip = blip()
    if (!rootBlip || !isAuthenticated()) {
      return false
    }

    if (isSuperuser()) {
      return true
    }

    // Admin controls remain owner-scoped.
    return user()?.id === rootBlip.user_id
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

  const updates = createMemo(() => store.updatesByParent(blip()?.id))
  const sharePreviewText = createMemo(() => {
    const content = blip()?.content ?? ""
    const plainText = stripMarkdownForMeta(content)
    if (!plainText) {
      return tr("metaDescription")
    }

    return plainText
  })
  const shareTitle = createMemo(() => {
    const preview = sharePreviewText()
    if (!preview || preview === tr("metaDescription")) {
      return tr("pageTitle")
    }

    return truncateForMeta(preview, MAX_SHARE_TITLE_LENGTH)
  })
  const shareDescription = createMemo(() =>
    truncateForMeta(sharePreviewText(), MAX_SHARE_DESCRIPTION_LENGTH),
  )
  const ogUrl = createMemo(() => {
    const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)
      ?.trim()
      .replace(/\/+$/, "")
    if (!siteUrl) {
      return ""
    }

    const path = location.pathname || `/blips/${params.id}`
    return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`
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
  const visibleUpdates = createMemo(() => {
    const allUpdates = updates()
    if (isAuthenticated()) {
      return allUpdates
    }
    return allUpdates.filter(update => update.published)
  })
  const rootComments = createMemo(() => store.commentsByParent(blip()?.id))
  const showComposer = createMemo(() => isUpdateOpenFor(blip()?.id))
  const visibleUpdateIds = createMemo(() =>
    visibleUpdates().map(update => update.id),
  )
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

    return [rootId, ...visibleUpdateIds()].join("|")
  })
  const reactionSignature = createMemo(() => getReactionSignature(blip()?.reactions ?? []))
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
    if (!loaded || loaded.length === 0) {
      return
    }
    const rootBlipId = blip()?.id ?? null
    if (!rootBlipId || lastSeededUpdatesForBlipId === rootBlipId) {
      return
    }

    lastSeededUpdatesForBlipId = rootBlipId
    untrack(() => {
      store.mergeIntoCache(loaded)
    })
  })

  createEffect(() => {
    const loadedComments = [...initialRootComments(), ...initialUpdateComments()]
    if (loadedComments.length === 0) {
      return
    }

    untrack(() => {
      store.mergeIntoCache(loadedComments)
    })
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

    currentBlip.id
    currentBlip.my_reaction_count
    currentBlip.reactions_count
    reactionSignature()
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
      onInsert: incoming => {
        markRealtimeUpdateAsRecent(incoming.id)
      },
      onUpdate: incoming => {
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
      id: visitor()?.id ?? null,
      status: visitor()?.status ?? null,
      displayName: visitor()?.displayName ?? null,
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

    const reactionBlipIds = untrack(() => [rootBlip.id, ...visibleUpdateIds()])
    void store.syncReactionViewer(reactionBlipIds, nextViewer, lastReactionViewer)
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

  const handleToggleReaction = async (emoji: string) => {
    const currentBlip = displayBlip()
    if (!currentBlip || isReactionBusy()) {
      return
    }

    const previousReactions = currentBlip.reactions ?? []
    const previousCount = currentBlip.my_reaction_count ?? 0
    const hasActiveReaction =
      previousReactions.find(reaction => reaction.emoji === emoji)?.reacted_by_current_user ??
      false
    const optimisticOverride = buildOptimisticReactionState({
      reactions: previousReactions,
      myReactionCount: previousCount,
      emoji,
      nextActive: !hasActiveReaction,
      visitorDisplayName: visitor()?.displayName ?? null,
    })
    const applyVisibleReactionState = (next: ReactionStateOverride) => {
      setReactionStateOverride(next)
      store.updateCachedReactionState(currentBlip.id, next)
    }

    setIsReactionBusy(true)
    applyVisibleReactionState(optimisticOverride)

    const result = await reactions.toggleReaction(currentBlip.id, emoji, {
      visitorId: visitor()?.id ?? null,
      visitorStatus: visitor()?.status ?? null,
      currentCount: previousCount,
      hasActiveReaction,
    })

    setIsReactionBusy(false)

    if (result.error || !result.data) {
      applyVisibleReactionState(createReactionStateOverride(previousReactions, previousCount))
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
      <Title>{windowTitle(shareTitle())}</Title>
      <Show when={blip()}>
        <Meta
          name="description"
          content={shareDescription()}
        />
        <Meta
          property="og:type"
          content="article"
        />
        <Meta
          property="og:title"
          content={shareTitle()}
        />
        <Meta
          property="og:description"
          content={shareDescription()}
        />
        <Show when={ogUrl()}>
          <Meta
            property="og:url"
            content={ogUrl()}
          />
        </Show>
        <Meta
          name="twitter:card"
          content="summary_large_image"
        />
        <Meta
          name="twitter:title"
          content={shareTitle()}
        />
        <Meta
          name="twitter:description"
          content={shareDescription()}
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
                      <header class="blip-detail-header">
                        <span class="blip-detail-timestamp">
                          {formatBlipTimestamp(data().created_at)}
                        </span>
                      </header>
                      <div class="blip-detail-content">
                        <Markdown content={data().content ?? ""} />
                      </div>
                      <footer class="blip-detail-footer">
                        <div class="blip-detail-footer-top-row">
                          <div class="tags">
                            <Show when={visibleRootTags().length > 0}>
                              <Hashtag size="0.85rem" />
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
                                store.updateCachedReactionState(data().id, nextState)
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
                          <Show
                            when={
                              visibleUpdates().length > 0 ||
                              canManageUpdates() ||
                              showComposer()
                            }>
                            <div class="blip-detail-updates-group">
                              <div class="blip-updates-chip">
                                <span class="blip-updates-chip-label">
                                  {tr("updates.label")}
                                </span>
                                <span class="blip-updates-chip-count">
                                  {visibleUpdates().length}
                                </span>
                              </div>
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
                            </div>
                          </Show>
                        </div>
                        <div class="blip-detail-meta-row-end">
                          <Show when={rootComments().length > 0}>
                            <div class="blip-comments-chip">
                              <span class="blip-comments-chip-label">
                                {commentThreadTr("title")}
                              </span>
                              <span class="blip-comments-chip-count">
                                {rootComments().length}
                              </span>
                            </div>
                          </Show>
                        </div>
                      </div>
                      <BlipCommentThread
                        parentBlip={blip() ?? data()}
                        comments={rootComments()}
                        showHeader={false}
                        showInlineMount={false}
                      />
                      <Show
                        when={
                          canManageUpdates() ||
                          visibleUpdates().length > 0 ||
                          showComposer()
                        }>
                        <section class="blip-updates-section">
                          <div
                            ref={element => {
                              updateInlineMountElement = element
                              registerUpdateInlineMount(params.id, element)
                            }}
                          />
                          <Show when={visibleUpdates().length > 0}>
                            <ul class="blip-updates-list">
                              <For each={visibleUpdates()}>
                                {update => (
                                  <UpdateBlip
                                    blip={update}
                                    comments={store.commentsByParent(update.id)}
                                    onEdit={handleEditUpdate}
                                    isRecentRealtime={
                                      recentRealtimeUpdateStates()[update.id] !==
                                      undefined
                                    }
                                    isShimmering={
                                      recentRealtimeUpdateStates()[update.id]
                                        ?.shimmering === true
                                    }
                                  />
                                )}
                              </For>
                            </ul>
                          </Show>
                        </section>
                      </Show>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Show>
          </div>
        </section>
      </main>
    </>
  )
}
