import { createAsync, useNavigate, useParams } from "@solidjs/router"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { getRequestEvent } from "solid-js/web"
import { Seo } from "@/components/seo"
import { formatTagTitle, formatTagDescription } from "@/modules/blips/seo"
import { Button } from "@/components/button"
import { LoadingSpinner } from "@/components/icon"
import { Blips } from "@/modules/blips/components/blips"
import { getBlipsByTag } from "@/modules/blips/data"
import type { Blip } from "@/modules/blips/data/schema"
import { isBlipPubliclyVisible } from "@/modules/blips/util"
import { useAuth } from "@/context/auth-context"
import { PageSection } from "@/modules/home/components/page-section"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { withWindow } from "@/util/browser"
import "./index.css"

const BLIPS_PAGE_SIZE = 20
const tr = ptr("blips.views.tag")

export function BlipsTagView() {
  const params = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth() as any
  const initialBlips = createAsync(() => getBlipsByTag(params.tag, BLIPS_PAGE_SIZE, 0))
  const [blips, setBlips] = createSignal<Blip[]>([])
  const [isLoadingMore, setIsLoadingMore] = createSignal(false)
  const [hasMore, setHasMore] = createSignal(true)
  const hasInitialData = createMemo(() => initialBlips() !== undefined)
  const visibleBlips = createMemo(() => {
    const storeData = blips()
    // Use store data when available, fall back to SSR data for initial render
    const allBlips = storeData.length > 0 ? storeData : (initialBlips() ?? [])
    if (isAuthenticated()) {
      return allBlips
    }
    return allBlips.filter(blip => isBlipPubliclyVisible(blip))
  })
  const hasBlipItems = createMemo(() => visibleBlips().length > 0)
  let showMoreButtonRef: HTMLButtonElement | undefined

  // Set 404 status during SSR when tag definitively has no blips
  // Only set 404 if initialBlips has resolved (not undefined) AND is empty array
  const initialData = initialBlips()
  if (initialData !== undefined && initialData.length === 0) {
    const event = getRequestEvent()
    if (event && event.response) {
      event.response.status = 404
    }
  }

  createEffect(() => {
    const data = initialBlips()
    if (!data) {
      return
    }
    setBlips(data)
    setHasMore(data.length === BLIPS_PAGE_SIZE)
  })

  const loadMore = async (e: MouseEvent) => {
    e.preventDefault()

    if (isLoadingMore() || !hasMore()) {
      return
    }

    setIsLoadingMore(true)
    try {
      const currentBlips = blips()
      const nextBlips = await getBlipsByTag(params.tag, BLIPS_PAGE_SIZE, currentBlips.length)
      const mergedBlips = [...currentBlips]
      const existingIds = new Set(currentBlips.map(blip => blip.id))

      for (const blip of nextBlips) {
        if (existingIds.has(blip.id)) {
          continue
        }
        existingIds.add(blip.id)
        mergedBlips.push(blip)
      }

      setBlips(mergedBlips)
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
      <Seo
        title={formatTagTitle(params.tag)}
        description={formatTagDescription(params.tag)}
        path={`/blips/tag/${params.tag}`}
        type="website"
        image="/og-image.jpg"
        imageWidth={1200}
        imageHeight={630}
        noindex={!hasBlipItems() && !hasMore()}
      />
      <main>
        <PageSection 
          class="signals"
          title={formatTagTitle(params.tag)}
          subtitle={
            <a href={pages.blipsTags} class="blips-all-tags-link">
              Browse all tags
            </a>
          }>
          <Show
            when={hasInitialData()}
            fallback={
              <div class="blips-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading", { tag: params.tag })}</p>
              </div>
            }>
            <Show
              when={hasBlipItems()}
              fallback={
                <Show when={!hasMore()}>
                  <p class="blips-empty-state">{tr("empty", { tag: params.tag })}</p>
                </Show>
              }>
              <Blips
                blips={visibleBlips()}
                onView={handleViewBlip}
              />
            </Show>
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
