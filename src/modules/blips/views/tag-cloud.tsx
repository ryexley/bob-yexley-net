import { createAsync, useNavigate } from "@solidjs/router"
import { createMemo, For, Show } from "solid-js"
import { Meta, Title } from "@solidjs/meta"
import { LoadingSpinner } from "@/components/icon"
import { getAllPublicTagsWithCounts } from "@/modules/blips/data/queries"
import type { TagWithCount } from "@/modules/blips/data/tags-schema"
import { PageSection } from "@/modules/home/components/page-section"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import "./tag-cloud.css"

const tr = ptr("blips.views.tagCloud")

export function TagCloudView() {
  const tagsData = createAsync(() => getAllPublicTagsWithCounts())
  const hasData = createMemo(() => tagsData() !== undefined)
  const tags = createMemo(() => tagsData() ?? [])

  const getSizeClass = (tag: TagWithCount): string => {
    const count = tag.blip_count
    const allCounts = tags().map(t => t.blip_count)
    if (allCounts.length === 0) {
      return "size-3"
    }

    const minCount = Math.min(...allCounts)
    const maxCount = Math.max(...allCounts)

    if (minCount === maxCount) {
      return "size-3"
    }

    const logMin = Math.log(minCount || 1)
    const logMax = Math.log(maxCount)
    const logCount = Math.log(count)
    
    const normalized = (logCount - logMin) / (logMax - logMin)

    if (normalized < 0.2) {
      return "size-1"
    }
    if (normalized < 0.4) {
      return "size-2"
    }
    if (normalized < 0.6) {
      return "size-3"
    }
    if (normalized < 0.8) {
      return "size-4"
    }
    return "size-5"
  }

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <PageSection
        id="tag-cloud"
        title={tr("title")}
        subtitle={tr("subtitle")}>
        <Show
          when={hasData()}
          fallback={
            <div class="tag-cloud-loading">
              <LoadingSpinner size="2rem" />
              <p>{tr("loading")}</p>
            </div>
          }>
          <Show
            when={tags().length > 0}
            fallback={
              <div class="tag-cloud-empty">
                <p>{tr("empty")}</p>
              </div>
            }>
            <div class="tag-cloud-container">
              <For each={tags()}>
                {tag => (
                  <a
                    href={pages.blipsTag(tag.name)}
                    class={`tag-cloud-link ${getSizeClass(tag)}`}
                    title={`${tag.name} (${tag.blip_count} ${tag.blip_count === 1 ? "blip" : "blips"})`}>
                    {tag.name}
                  </a>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </PageSection>
    </>
  )
}

export default TagCloudView
