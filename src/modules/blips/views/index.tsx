import { createAsync, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack } from "solid-js"
import { Button } from "@/components/button"
import { LoadingSpinner } from "@/components/icon"
import { PageSection } from "@/modules/home/components/page-section"
import { Blips } from "@/modules/blips/components/blips"
import { BLIP_TYPES, blipStore, getBlips } from "@/modules/blips/data"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle, withWindow } from "@/util/browser"
import "./index.css"

const BLIPS_PAGE_SIZE = 20
const tr = ptr("blips.views.index")

export function BlipsView() {
  const initialBlips = createAsync(() => getBlips(BLIPS_PAGE_SIZE, 0))
  let lastReactionViewerKey: string | null = null
  let lastReactionViewer = {
    id: null,
    status: null,
    displayName: null,
  } as const
  let reactionViewerBaselineCaptured = false
  const navigate = useNavigate()
  const supabase = useSupabase()
  const { isAuthenticated, userProfile, userSystem, loading } = useAuth() as any
  const [isLoadingMore, setIsLoadingMore] = createSignal(false)
  const [hasMore, setHasMore] = createSignal(true)
  let showMoreButtonRef: HTMLButtonElement | undefined

  const store = blipStore(supabase.client, {
    limit: BLIPS_PAGE_SIZE,
    subscribe: false,
  })
  const { entities: blips, setInitialData } = store
  const rootFeedBlips = createMemo(() =>
    (blips() ?? []).filter(
      blip => blip.parent_id === null && blip.blip_type === BLIP_TYPES.ROOT,
    ),
  )
  const visibleRootFeedBlips = createMemo(() => {
    const allRootFeedBlips = rootFeedBlips() ?? []
    if (isAuthenticated()) {
      return allRootFeedBlips
    }

    return allRootFeedBlips.filter(blip => blip.published)
  })
  const reactionWatchKey = createMemo(() =>
    visibleRootFeedBlips()
      .map(blip => blip.id)
      .join("|"),
  )
  const hasInitialData = createMemo(() => initialBlips() !== undefined)
  const hasBlipItems = createMemo(() => (visibleRootFeedBlips()?.length ?? 0) > 0)

  createEffect(() => {
    const ssrData = initialBlips()

    if (ssrData) {
      setInitialData(ssrData)
      setHasMore(ssrData.length === BLIPS_PAGE_SIZE)
    }
  })

  createEffect(() => {
    const watchKey = reactionWatchKey()
    if (!watchKey) {
      return
    }

    const blipIds = watchKey.split("|")
    const unsubscribe = store.watchReactions(blipIds)
    onCleanup(unsubscribe)
  })

  createEffect(() => {
    const watchKey = reactionWatchKey()
    if (!watchKey) {
      return
    }

    const blipIds = watchKey.split("|")
    const unsubscribe = store.watchBlips(blipIds, {
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
    if (loading()) {
      return
    }

    const nextViewer = {
      id: userProfile()?.id ?? null,
      status: userSystem()?.status ?? null,
      displayName: userProfile()?.displayName ?? null,
    }
    const nextViewerKey = [
      nextViewer.id ?? "__anon__",
      nextViewer.status ?? "",
      nextViewer.displayName ?? "",
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

    const blipIds = untrack(() => visibleRootFeedBlips().map(blip => blip.id))
    if (blipIds.length === 0) {
      lastReactionViewer = nextViewer
      return
    }

    void store.syncReactionViewer(blipIds, nextViewer, lastReactionViewer)
    lastReactionViewer = nextViewer
  })

  const loadMore = async (e: MouseEvent) => {
    e.preventDefault()

    if (isLoadingMore() || !hasMore()) {
      return
    }

    setIsLoadingMore(true)
    try {
      const currentBlips = blips() ?? []
      const currentRootBlips = rootFeedBlips() ?? []
      const nextBlips = await getBlips(BLIPS_PAGE_SIZE, currentRootBlips.length)

      const mergedBlips = [...currentBlips]
      const existingIds = new Set(currentBlips.map(blip => blip.id))

      for (const blip of nextBlips) {
        if (existingIds.has(blip.id)) {
          continue
        }
        existingIds.add(blip.id)
        mergedBlips.push(blip)
      }

      setInitialData(mergedBlips)
      setHasMore(nextBlips.length === BLIPS_PAGE_SIZE)

      withWindow((window: Window) => {
        window.requestAnimationFrame(() => {
          showMoreButtonRef?.scrollIntoView({
            behavior: "auto",
            block: "nearest",
            inline: "nearest",
          })
        })
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleViewBlip = (blipId: string) => {
    navigate(pages.blip(blipId), {
      scroll: true,
      state: {
        fromBlips: true,
      },
    })
  }

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main>
        <PageSection class="signals">
          <Show
            when={hasInitialData()}
            fallback={
              <div class="blips-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            <Blips
              blips={visibleRootFeedBlips() ?? []}
              onView={handleViewBlip}
            />
          </Show>
          <Show when={hasInitialData() && hasMore()}>
            <div class="w-full flex justify-center mt-4">
              <Button
                ref={(el: HTMLButtonElement) => {
                  showMoreButtonRef = el
                }}
                variant="ghost"
                size="sm"
                class="blips-show-more-button"
                onClick={loadMore}
                disabled={isLoadingMore()}
                label={
                  isLoadingMore()
                    ? tr("paging.actions.loading")
                    : tr("paging.actions.showMore")
                }
                iconRight={isLoadingMore() ? "autorenew" : "expand_circle_down"}
              />
            </div>
          </Show>
        </PageSection>
      </main>
    </>
  )
}
