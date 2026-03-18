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
import { PageSection } from "@/modules/home/components/page-section"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { IconButton } from "@/components/icon-button"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { BlipEditor } from "@/modules/blips/components/blip-editor"
import { BlipUpdateEditor } from "@/modules/blips/components/blip-update-editor"
import {
  BLIP_TYPES,
  blipStore,
  getBlip,
  getBlipUpdates,
  tagStore,
} from "@/modules/blips/data"
import { UpdateBlip } from "@/modules/blips/components/update-blip"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { clsx as cx } from "@/util"
import { windowTitle, withWindow } from "@/util/browser"
import "./blip.css"

const tr = ptr("blips.views.detail")

export function BlipView() {
  const REALTIME_UPDATE_HIGHLIGHT_MS = 60_000
  let lastSeededBlipId: string | null = null
  let lastSeededUpdatesForBlipId: string | null = null
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const store = blipStore(supabase.client, { subscribe: false })
  const tags = tagStore(supabase.client)
  const { isAuthenticated, user } = useAuth() as any
  const blipQuery = createAsync(() => getBlip(params.id))
  const initialUpdates = createAsync(() => getBlipUpdates(params.id))
  const blip = createMemo(() => {
    const fromStore = store.entities().find(item => item.id === params.id)
    return fromStore ?? blipQuery() ?? null
  })
  const [recentRealtimeUpdateStates, setRecentRealtimeUpdateStates] =
    createSignal<Record<string, { shimmering: boolean }>>({})
  const [showComposer, setShowComposer] = createSignal(false)
  const [hydratedRootTags, setHydratedRootTags] = createSignal<string[]>([])
  const [selectedUpdateBlipId, setSelectedUpdateBlipId] = createSignal<
    string | null
  >(null)
  const [showBlipEditor, setShowBlipEditor] = createSignal(false)
  const [selectedBlipId, setSelectedBlipId] = createSignal<string | null>(null)
  const realtimeUpdateHighlightTimeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()
  const canManageUpdates = createMemo(() => {
    const rootBlip = blip()
    if (!rootBlip || !isAuthenticated()) {
      return false
    }

    // Mirror the toolbar behavior: authenticated owner-only controls.
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
    const data = blip()
    const fromBlips = (location.state as any)?.fromBlips

    if (!data || !fromBlips) {
      return
    }

    withWindow((window: Window) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, 0)
        })
      })
    })
  })

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
    if (!loaded) {
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
    const rootBlip = blip()
    if (!rootBlip || !isAuthenticated() || rootBlip.published) {
      setHydratedRootTags([])
      return
    }
    if ((rootBlip.tags?.length ?? 0) > 0) {
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
    if (!canManageUpdates() && showComposer()) {
      setShowComposer(false)
    }
  })

  createEffect(() => {
    const rootBlip = blip()
    if (!rootBlip || rootBlip.blip_type !== BLIP_TYPES.ROOT) {
      return
    }

    const unsubscribe = store.watchUpdates(rootBlip.id, {
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
  })

  const handleEditRootBlip = async (rootBlipId: string) => {
    const currentRootBlip = blip()
    if (currentRootBlip?.id === rootBlipId) {
      // Seed the shared blip store so BlipEditor can resolve requested blipId.
      await store.upsert(currentRootBlip, { cacheOnly: true })
    }
    setSelectedBlipId(rootBlipId)
    setShowBlipEditor(true)
  }

  const closeEditor = () => {
    setShowBlipEditor(false)
    setSelectedBlipId(null)
  }

  const handleEditUpdate = (updateBlipId: string) => {
    setSelectedUpdateBlipId(updateBlipId)
    setShowComposer(true)
  }

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main>
        <PageSection class="blip-detail-page">
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
                  <article class="blip-detail-card">
                    <header class="blip-detail-header">
                      <span class="blip-detail-timestamp">
                        {formatBlipTimestamp(data().created_at)}
                      </span>
                    </header>
                    <div class="blip-detail-content">
                      <Markdown content={data().content ?? ""} />
                    </div>
                    <Show when={visibleRootTags().length > 0}>
                      <footer class="blip-detail-footer">
                        <div class="tags">
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
                        </div>
                      </footer>
                    </Show>
                  </article>
                  <BlipActions
                    blip={data()}
                    onEdit={handleEditRootBlip}
                    toolbarExtras={
                      <IconButton
                        size="xs"
                        icon="chat_add_on"
                        class={cx("blip-detail-add-update", {
                          active: showComposer(),
                        })}
                        iconClass="blip-detail-add-update-icon"
                        aria-label={
                          showComposer()
                            ? tr("actions.hideUpdateComposer")
                            : tr("actions.postUpdate")
                        }
                        onClick={() => {
                          setSelectedUpdateBlipId(null)
                          setShowComposer(current => !current)
                        }}
                      />
                    }
                  />
                  <Show when={visibleUpdates().length > 0 || showComposer()}>
                    <section class="blip-updates-section">
                      <Show when={visibleUpdates().length > 0}>
                        <header class="blip-updates-header">
                          <div class="blip-updates-chip">
                            <span class="blip-updates-chip-label">
                              {tr("updates.label")}
                            </span>
                            <span class="blip-updates-chip-count">
                              {visibleUpdates().length}
                            </span>
                          </div>
                        </header>
                      </Show>

                      <Show when={canManageUpdates()}>
                        <BlipUpdateEditor
                          open={showComposer()}
                          rootBlipId={blip()?.id}
                          editingUpdateId={selectedUpdateBlipId()}
                          onRequestClose={() => {
                            setShowComposer(false)
                            setSelectedUpdateBlipId(null)
                          }}
                        />
                      </Show>

                      <Show when={visibleUpdates().length > 0}>
                        <ul class="blip-updates-list">
                          <For each={visibleUpdates()}>
                            {update => (
                              <UpdateBlip
                                blip={update}
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
                  <BlipEditor
                    open={showBlipEditor()}
                    blipId={selectedBlipId()}
                    onPanelOpenChange={open => {
                      setShowBlipEditor(open)
                      if (!open) {
                        setSelectedBlipId(null)
                      }
                    }}
                    close={closeEditor}
                  />
                </>
              )}
            </Show>
          </div>
        </PageSection>
      </main>
    </>
  )
}
