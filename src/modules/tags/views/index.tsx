import { createAsync, revalidate, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { useConfirm } from "@/components/confirm-dialog"
import { Icon, LoadingSpinner } from "@/components/icon"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
import { Select, type SelectOption } from "@/components/select"
import { Stack } from "@/components/stack"
import { useAuth } from "@/context/auth-context"
import { RequiresAdmin } from "@/modules/auth/components/requires-role"
import { TagEditDrawer } from "@/modules/tags/components/tag-edit-drawer"
import { resolveTagCoverUrl } from "@/modules/tags/cover"
import { mergeAdminTags } from "@/modules/tags/data/client"
import { getAdminTags } from "@/modules/tags/data/queries"
import type {
  AdminTagRecord,
} from "@/modules/tags/data/types"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import "./index.css"

const tr = ptr("tags.views.index")

export function TagsView() {
  const navigate = useNavigate()
  const auth = useAuth()
  const confirm = useConfirm()
  const notify = useNotify()
  const adminTagsQuery = createAsync(() => getAdminTags())
  const [tags, setTags] = createSignal<AdminTagRecord[]>([])
  const [selectedTagId, setSelectedTagId] = createSignal<string | null>(null)
  const [searchValue, setSearchValue] = createSignal("")
  const [sortField, setSortField] = createSignal<"name" | "blipCount">("name")
  const [sortDirection, setSortDirection] = createSignal<"asc" | "desc">("asc")

  createEffect(() => {
    const result = adminTagsQuery()
    if (!result?.tags) {
      return
    }

    setTags(result.tags)
  })

  createEffect(() => {
    if (auth.loading()) {
      return
    }

    if (!auth.isAdmin()) {
      navigate(auth.isAuthenticated() ? pages.home : pages.login, {
        replace: true,
      })
    }
  })

  createEffect(() => {
    const result = adminTagsQuery()
    if (auth.loading() || !auth.isAdmin() || result === undefined) {
      return
    }

    if (!result.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const selectedTag = createMemo(
    () => tags().find(tag => tag.id === selectedTagId()) ?? null,
  )
  const hasQueryResult = createMemo(() => adminTagsQuery() !== undefined)
  const pageError = createMemo(() => adminTagsQuery()?.error ?? null)
  
  const filteredTags = createMemo(() => {
    const query = searchValue().trim().toLowerCase()
    const currentSortField = sortField()
    const currentSortDirection = sortDirection()
    const nextTags = tags().filter(tag => {
      const matchesSearch =
        query.length === 0 ||
        tag.name.toLowerCase().includes(query) ||
        (tag.description ?? "").toLowerCase().includes(query)

      return matchesSearch
    })

    const sorted = [...nextTags].sort((left, right) => {
      const multiplier = currentSortDirection === "asc" ? 1 : -1

      if (currentSortField === "name") {
        return (
          left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
          }) * multiplier
        )
      }

      return (left.blipCount - right.blipCount) * multiplier
    })

    return sorted
  })
  
  const summary = createMemo(() =>
    tr("summary", {
      visible: filteredTags().length,
      total: tags().length,
    }),
  )
  
  const sortOptions = createMemo<SelectOption[]>(() => [
    {
      value: "name",
      label: tr("sort.fields.name"),
    },
    {
      value: "blipCount",
      label: tr("sort.fields.blipCount"),
    },
  ])
  
  const emptyMessage = createMemo(() => {
    if (pageError()) {
      return pageError()
    }

    if (tags().length === 0) {
      return tr("empty.noTags")
    }

    return tr("empty.noMatches")
  })

  const handleTagSaved = (updatedTag: AdminTagRecord) => {
    setTags(currentTags =>
      currentTags.map(tag => (tag.id === updatedTag.id ? updatedTag : tag)),
    )
  }

  const handleNameConflict = (conflictingTagId: string, attemptedName: string) => {
    const conflictingTag = tags().find(t => t.id === conflictingTagId)
    if (!conflictingTag || !selectedTag()) {
      return
    }

    confirm({
      title: tr("mergeDialog.title"),
      prompt: tr("mergeDialog.prompt", {
        attemptedName,
        existingTag: conflictingTag.name,
        blipCount: conflictingTag.blipCount,
      }),
      confirmationActionLabel: tr("mergeDialog.actions.merge", {
        targetTag: conflictingTag.name,
      }),
      confirmationActionLoadingLabel: tr("mergeDialog.actions.merging"),
      cancelActionLabel: tr("mergeDialog.actions.changeName"),
      variant: "default",
      onConfirm: async () => {
        const sourceId = selectedTag()?.id
        if (!sourceId) {
          return
        }

        const result = await mergeAdminTags({
          sourceId,
          targetId: conflictingTagId,
        })

        if (!result.success) {
          notify.error({
            title: tr("notifications.mergeError"),
            content: result.error ?? tr("notifications.mergeError"),
          })
          return
        }

        // Remove the merged tag locally, close the drawer, then refetch so the
        // target's blip count / inherited description / cover are accurate.
        setTags(currentTags => currentTags.filter(t => t.id !== sourceId))
        setSelectedTagId(null)
        await revalidate(getAdminTags.key)

        notify.success({
          content: tr("notifications.mergeSuccess"),
        })
      },
    })
  }

  const getThumbnailUrl = (tag: AdminTagRecord): string | null =>
    resolveTagCoverUrl(tag.coverImage)

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="tags-view">
        <a
          href={pages.admin}
          class="tags-view-back-link">
          <Icon name="arrowLeft" />
          {tr("actions.backToAdmin")}
        </a>
        <div class="tags-view-shell">
          <div class="tags-view-header">
            <div class="tags-view-header-copy">
              <h1 class="tags-view-title">{tr("title")}</h1>
              <p class="tags-view-subtitle">{tr("subtitle")}</p>
            </div>
          </div>

          <RequiresAdmin
            fallback={
              <div class="tags-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            <Show
              when={hasQueryResult()}
              fallback={
                <div class="tags-view-loading-state">
                  <LoadingSpinner size="2rem" />
                  <p>{tr("loading")}</p>
                </div>
              }>
            <Stack
              orient="row"
              align="center"
              justify="space-between"
              fullWidth
              class="tags-view-toolbar">
                <Input
                  label=""
                  type="search"
                  value={searchValue()}
                  placeholder={tr("filters.search.placeholder")}
                  onInput={event => setSearchValue(event.currentTarget.value)}
                  containerClass="tags-view-search"
                />
                
                <Stack orient="row" align="center" gap="0.5rem">
                  <Select
                    options={sortOptions()}
                    value={sortField()}
                    onChange={value => {
                      if (value) {
                        setSortField(value as "name" | "blipCount")
                      }
                    }}
                    aria-label={tr("sort.fieldLabel")}
                    containerClass="tags-view-sort-field"
                    triggerClass="tags-view-sort-trigger"
                  />

                  <button
                    type="button"
                    class="tags-view-toolbar-icon-button"
                    aria-label={
                      sortDirection() === "desc"
                        ? tr("sort.direction.desc")
                        : tr("sort.direction.asc")
                    }
                    onClick={() =>
                      setSortDirection(direction => (direction === "desc" ? "asc" : "desc"))
                    }>
                    <Icon name={sortDirection() === "desc" ? "arrowDown" : "arrowUp"} />
                  </button>
                </Stack>
              </Stack>

            <div class="tags-view-summary">
              <span>{summary()}</span>
            </div>

            <Show
              when={filteredTags().length > 0}
              fallback={<div class="tags-view-empty-state">{emptyMessage()}</div>}>
              <div class="tags-view-grid">
                <For each={filteredTags()}>
                  {tag => (
                    <button
                      type="button"
                      class="tags-view-card"
                      onClick={() => setSelectedTagId(tag.id)}>
                      <div class="tags-view-card-header">
                        <Show when={getThumbnailUrl(tag)}>
                          {url => (
                            <img
                              src={url()}
                              alt=""
                              class="tags-view-card-thumbnail"
                            />
                          )}
                        </Show>
                        <div class="tags-view-card-info">
                          <h3 class="tags-view-card-name">{tag.name}</h3>
                          <p class="tags-view-card-meta">
                            {tr("blipCount", { count: tag.blipCount })}
                          </p>
                        </div>
                      </div>
                      <Show when={tag.description}>
                        <p class="tags-view-card-description">{tag.description}</p>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
            </Show>
          </RequiresAdmin>
        </div>

        <TagEditDrawer
          open={selectedTag() !== null}
          tag={selectedTag()}
          onOpenChange={open => {
            if (!open) {
              setSelectedTagId(null)
            }
          }}
          onSaved={updatedTag => handleTagSaved(updatedTag)}
          onConflict={handleNameConflict}
        />
      </main>
    </>
  )
}

export default TagsView
