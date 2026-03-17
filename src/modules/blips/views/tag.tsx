import { createAsync, useNavigate, useParams } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Button } from "@/components/button"
import { LoadingSpinner } from "@/components/icon"
import { Blips } from "@/modules/blips/components/blips"
import { getBlipsByTag } from "@/modules/blips/data"
import type { Blip } from "@/modules/blips/data/schema"
import { PageSection } from "@/modules/home/components/page-section"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle, withWindow } from "@/util/browser"
import "./index.css"

const BLIPS_PAGE_SIZE = 20
const tr = ptr("blips.views.tag")

export function BlipsTagView() {
  const params = useParams()
  const navigate = useNavigate()
  const initialBlips = createAsync(() => getBlipsByTag(params.tag, BLIPS_PAGE_SIZE, 0))
  const [blips, setBlips] = createSignal<Blip[]>([])
  const [isLoadingMore, setIsLoadingMore] = createSignal(false)
  const [hasMore, setHasMore] = createSignal(true)
  const hasInitialData = createMemo(() => initialBlips() !== undefined)
  const hasBlipItems = createMemo(() => blips().length > 0)
  let showMoreButtonRef: HTMLButtonElement | undefined

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
      <Title>{windowTitle(tr("pageTitle", { tag: params.tag }))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription", { tag: params.tag })}
      />
      <main>
        <PageSection class="signals">
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
                <p class="blips-empty-state">{tr("empty", { tag: params.tag })}</p>
              }>
              <Blips
                blips={blips()}
                onView={handleViewBlip}
              />
            </Show>
          </Show>
          <Show when={hasInitialData() && hasBlipItems() && hasMore()}>
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
