import { createAsync, useLocation, useNavigate, useParams } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, For, Show } from "solid-js"
import { Hashtag, Icon } from "@/components/icon"
import { PageSection } from "@/modules/home/components/page-section"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { getBlip } from "@/modules/blips/data"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle, withWindow } from "@/util/browser"
import "./blip.css"

const tr = ptr("blips.views.detail")

export function BlipView() {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const blip = createAsync(() => getBlip(params.id))

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

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main>
        <PageSection class="blip-detail-page">
          <div class="blip-detail-container">
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
                {blip() === undefined ? tr("loading") : tr("notFound")}
                </p>
              }>
              {data => (
                <article class="blip-detail-card">
                  <header class="blip-detail-header">
                    <span class="blip-detail-timestamp">
                      {formatBlipTimestamp(data().created_at)}
                    </span>
                  </header>
                  <div class="blip-detail-content">
                    <Markdown content={data().content ?? ""} />
                  </div>
                  <Show when={(data().tags?.length ?? 0) > 0}>
                    <footer class="blip-detail-footer">
                      <div class="tags">
                        <Hashtag size="0.85rem" />
                        <ul class="tag-list">
                          <For each={data().tags}>
                            {tag => <li class="tag">{tag}</li>}
                          </For>
                        </ul>
                      </div>
                    </footer>
                  </Show>
                </article>
              )}
            </Show>
          </div>
        </PageSection>
      </main>
    </>
  )
}
