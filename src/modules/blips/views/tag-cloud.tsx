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

// Number of evenly spaced size/weight steps defined in tag-cloud.css
const SIZE_STEPS = 6
const DEFAULT_SIZE_STEP = 3

export function TagCloudView() {
  const tagsData = createAsync(() => getAllPublicTagsWithCounts())
  const hasData = createMemo(() => tagsData() !== undefined)
  const tags = createMemo(() => tagsData() ?? [])

  const getSizeClass = (tag: TagWithCount): string => {
    const allCounts = tags().map(t => t.blip_count)
    if (allCounts.length === 0) {
      return `tag-cloud-size-${DEFAULT_SIZE_STEP}`
    }

    const minCount = Math.min(...allCounts)
    const maxCount = Math.max(...allCounts)

    if (minCount === maxCount) {
      return `tag-cloud-size-${DEFAULT_SIZE_STEP}`
    }

    const logMin = Math.log(minCount || 1)
    const logMax = Math.log(maxCount)
    const logCount = Math.log(tag.blip_count || 1)

    const normalized = (logCount - logMin) / (logMax - logMin)
    const step = Math.min(
      SIZE_STEPS,
      Math.max(1, Math.floor(normalized * SIZE_STEPS) + 1),
    )

    return `tag-cloud-size-${step}`
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
        class="tag-cloud-section">
        <header class="tag-cloud-header">
          <h1 class="tag-cloud-title">{tr("title")}</h1>
          <p class="tag-cloud-subtitle">{tr("subtitle")}</p>
        </header>
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
                    title={tr("linkTitle", { name: tag.name, count: tag.blip_count })}>
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
