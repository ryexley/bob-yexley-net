import { createAsync, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, For, Show, onCleanup } from "solid-js"
import { Button } from "@/components/button"
import { Icon, LoadingSpinner } from "@/components/icon"
import { Input } from "@/components/input"
import { Select, type SelectOption } from "@/components/select"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { RequiresSuperUser } from "@/modules/auth/components/requires-role"
import { CollectionFormDrawer } from "@/modules/scripture-collections/components/collection-form-drawer"
import {
  getAdminCollections,
  scriptureCollectionStore,
} from "@/modules/scripture-collections/data"
import type {
  CollectionSortField,
  SortDirection,
} from "@/modules/scripture-collections/data/types"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import { formatLongDate } from "@/util/formatters"
import "./index.css"

const tr = ptr("scriptureCollections.views.index")
const FILTER_PANEL_ANIMATION_MS = 200

type DrawerState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "view"; collectionId: number }

export function ScriptureCollectionsView() {
  const navigate = useNavigate()
  const auth = useAuth()
  const supabase = useSupabase()
  const adminCollectionsQuery = createAsync(() => getAdminCollections())
  const store = scriptureCollectionStore(supabase.client, { subscribe: false })
  const [drawerState, setDrawerState] = createSignal<DrawerState>({ mode: "closed" })
  const [searchValue, setSearchValue] = createSignal("")
  const [sortField, setSortField] = createSignal<CollectionSortField>("name")
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("asc")
  const [filtersOpen, setFiltersOpen] = createSignal(false)
  const [filtersRendered, setFiltersRendered] = createSignal(false)
  const [filtersVisible, setFiltersVisible] = createSignal(false)
  let filtersUnmountTimeout: ReturnType<typeof setTimeout> | null = null
  let filtersOpenAnimationFrame: number | null = null

  const collections = createMemo(() => store.adminRecords())

  const clearFiltersUnmountTimeout = () => {
    if (filtersUnmountTimeout) {
      clearTimeout(filtersUnmountTimeout)
      filtersUnmountTimeout = null
    }
  }

  const clearFiltersOpenAnimationFrame = () => {
    if (filtersOpenAnimationFrame !== null) {
      cancelAnimationFrame(filtersOpenAnimationFrame)
      filtersOpenAnimationFrame = null
    }
  }

  createEffect(() => {
    if (filtersOpen()) {
      clearFiltersUnmountTimeout()
      clearFiltersOpenAnimationFrame()
      setFiltersRendered(true)
      setFiltersVisible(false)
      filtersOpenAnimationFrame = requestAnimationFrame(() => {
        setFiltersVisible(true)
        filtersOpenAnimationFrame = null
      })
      return
    }

    if (!filtersRendered()) {
      return
    }

    clearFiltersUnmountTimeout()
    clearFiltersOpenAnimationFrame()
    setFiltersVisible(false)
    filtersUnmountTimeout = setTimeout(() => {
      setFiltersRendered(false)
      filtersUnmountTimeout = null
    }, FILTER_PANEL_ANIMATION_MS)
  })

  onCleanup(() => {
    clearFiltersUnmountTimeout()
    clearFiltersOpenAnimationFrame()
  })

  createEffect(() => {
    const result = adminCollectionsQuery()
    if (!result?.collections) {
      return
    }

    store.mergeIntoCache(
      result.collections.map(collection => ({
        id: String(collection.id),
        name: collection.name,
        description: collection.description,
        slug: collection.slug,
        created_at: collection.createdAt,
        updated_at: collection.updatedAt,
        reference_count: collection.referenceCount,
      })),
    )
  })

  createEffect(() => {
    if (auth.loading()) {
      return
    }

    if (!auth.isSuperuser()) {
      navigate(auth.isAuthenticated() ? pages.home : pages.login, {
        replace: true,
      })
    }
  })

  createEffect(() => {
    const result = adminCollectionsQuery()
    if (auth.loading() || !auth.isSuperuser() || result === undefined) {
      return
    }

    if (!result.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const drawerOpen = createMemo(() => drawerState().mode !== "closed")
  const drawerMode = createMemo(() => {
    const state = drawerState()
    return state.mode === "closed" ? "create" : state.mode
  })
  const viewingCollection = createMemo(() => {
    const state = drawerState()
    if (state.mode !== "view") {
      return null
    }

    return collections().find(collection => collection.id === state.collectionId) ?? null
  })
  const hasQueryResult = createMemo(() => adminCollectionsQuery() !== undefined)
  const pageError = createMemo(() => adminCollectionsQuery()?.error ?? null)
  const hasFiltersApplied = createMemo(() => searchValue().trim().length > 0)
  const filteredCollections = createMemo(() => {
    const query = searchValue().trim().toLowerCase()
    const currentSortField = sortField()
    const currentSortDirection = sortDirection()

    const nextCollections = collections().filter(collection => {
      if (query.length === 0) {
        return true
      }

      return (
        collection.name.toLowerCase().includes(query) ||
        collection.slug.toLowerCase().includes(query) ||
        (collection.description ?? "").toLowerCase().includes(query)
      )
    })

    return [...nextCollections].sort((left, right) => {
      const multiplier = currentSortDirection === "asc" ? 1 : -1

      if (currentSortField === "createdAt") {
        return (
          (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) *
          multiplier
        )
      }

      return (
        left.name.localeCompare(right.name, undefined, {
          sensitivity: "base",
        }) * multiplier
      )
    })
  })
  const summary = createMemo(() =>
    tr("summary", {
      visible: filteredCollections().length,
      total: collections().length,
    }),
  )
  const sortOptions = createMemo<SelectOption[]>(() => [
    {
      value: "name",
      label: tr("sort.fields.name"),
    },
    {
      value: "createdAt",
      label: tr("sort.fields.createdAt"),
    },
  ])
  const emptyMessage = createMemo(() => {
    if (pageError()) {
      return pageError()
    }

    if (collections().length === 0) {
      return tr("empty.noCollections")
    }

    return tr("empty.noMatches")
  })

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="scripture-collections-view">
        <a
          href={pages.scripture}
          class="scripture-collections-view-back-link">
          <Icon name="arrow_back" />
          {tr("actions.backToScripture")}
        </a>
        <div class="scripture-collections-view-shell">
          <div class="scripture-collections-view-header">
            <div class="scripture-collections-view-header-copy">
              <h1 class="scripture-collections-view-title">{tr("title")}</h1>
              <p class="scripture-collections-view-subtitle">{tr("subtitle")}</p>
            </div>
          </div>

          <RequiresSuperUser
            fallback={
              <div class="scripture-collections-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            <Show
              when={hasQueryResult()}
              fallback={
                <div class="scripture-collections-view-loading-state">
                  <LoadingSpinner size="2rem" />
                  <p>{tr("loading")}</p>
                </div>
              }>
              <div class="scripture-collections-view-toolbar">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  class="scripture-collections-view-create-button"
                  label={tr("actions.create")}
                  onClick={() => setDrawerState({ mode: "create" })}
                />

                <div class="scripture-collections-view-toolbar-controls">
                  <Select
                    options={sortOptions()}
                    value={sortField()}
                    onChange={value => {
                      if (value) {
                        setSortField(value as CollectionSortField)
                      }
                    }}
                    aria-label={tr("sort.fieldLabel")}
                    containerClass="scripture-collections-view-sort-field"
                    triggerClass="scripture-collections-view-sort-trigger"
                  />

                  <button
                    type="button"
                    class="scripture-collections-view-toolbar-icon-button"
                    aria-label={
                      sortDirection() === "desc"
                        ? tr("sort.direction.desc")
                        : tr("sort.direction.asc")
                    }
                    onClick={() =>
                      setSortDirection(direction => (direction === "desc" ? "asc" : "desc"))
                    }>
                    <Icon name={sortDirection() === "desc" ? "south" : "north"} />
                  </button>

                  <button
                    type="button"
                    class="scripture-collections-view-toolbar-icon-button"
                    classList={{
                      "is-active": filtersOpen(),
                    }}
                    aria-label={
                      filtersOpen() ? tr("actions.hideFilters") : tr("actions.showFilters")
                    }
                    onClick={() => setFiltersOpen(open => !open)}>
                    <Icon name={filtersOpen() ? "filter_alt_off" : "filter_alt"} />
                  </button>
                </div>
              </div>

              <Show when={filtersRendered()}>
                <div
                  class="scripture-collections-view-filters-motion"
                  classList={{
                    "is-open": filtersVisible(),
                  }}>
                  <div class="scripture-collections-view-filters">
                    <Input
                      label={tr("filters.search.label")}
                      type="search"
                      value={searchValue()}
                      placeholder={tr("filters.search.placeholder")}
                      onInput={event => setSearchValue(event.currentTarget.value)}
                    />
                    <div class="scripture-collections-view-filter-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        label={tr("actions.clearFilters")}
                        disabled={!hasFiltersApplied()}
                        onClick={() => setSearchValue("")}
                      />
                    </div>
                  </div>
                </div>
              </Show>

              <div class="scripture-collections-view-summary">
                <span>{summary()}</span>
              </div>

              <Show
                when={filteredCollections().length > 0}
                fallback={
                  <div class="scripture-collections-view-empty-state">{emptyMessage()}</div>
                }>
                <div class="scripture-collections-view-list">
                  <For each={filteredCollections()}>
                    {collection => (
                      <button
                        type="button"
                        class="scripture-collections-view-card"
                        onClick={() =>
                          setDrawerState({ mode: "view", collectionId: collection.id })
                        }>
                        <div class="scripture-collections-view-card-header">
                          <div class="scripture-collections-view-card-copy">
                            <div class="scripture-collections-view-card-name">
                              {collection.name}
                            </div>
                            <div class="scripture-collections-view-card-slug">
                              {collection.slug}
                            </div>
                          </div>
                          <span class="scripture-collections-view-reference-count">
                            {tr("fields.referenceCount", {
                              count: collection.referenceCount,
                            })}
                          </span>
                        </div>
                        <Show when={collection.description}>
                          {description => (
                            <p class="scripture-collections-view-card-description">
                              {description()}
                            </p>
                          )}
                        </Show>
                        <div class="scripture-collections-view-card-footer">
                          <div class="scripture-collections-view-card-updated">
                            <span class="scripture-collections-view-card-updated-label">
                              {tr("fields.updatedAt")}
                            </span>
                            <span class="scripture-collections-view-card-updated-value">
                              {formatLongDate(collection.updatedAt) ?? tr("values.unavailable")}
                            </span>
                          </div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </RequiresSuperUser>
        </div>

        <CollectionFormDrawer
          open={drawerOpen()}
          mode={drawerMode()}
          collection={viewingCollection()}
          store={store}
          onOpenChange={open => {
            if (!open) {
              setDrawerState({ mode: "closed" })
            }
          }}
        />
      </main>
    </>
  )
}

export default ScriptureCollectionsView
