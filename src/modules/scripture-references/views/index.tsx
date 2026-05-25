import { createAsync, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, Show, onCleanup } from "solid-js"
import { Button } from "@/components/button"
import { Icon, LoadingSpinner } from "@/components/icon"
import { Input } from "@/components/input"
import { Select, type SelectOption } from "@/components/select"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { RequiresSuperUser } from "@/modules/auth/components/requires-role"
import {
  getAdminCollections,
  scriptureCollectionStore,
} from "@/modules/scripture-collections/data"
import { ReferenceFormDrawer } from "@/modules/scripture-references/components/reference-form-drawer"
import { ReferenceCardsGrid } from "@/modules/scripture-references/components/reference-cards-grid"
import {
  getAdminReferences,
  scriptureReferenceStore,
} from "@/modules/scripture-references/data"
import type {
  AdminReferenceRecord,
  ReferenceCollectionFilter,
  ReferenceSortField,
  SortDirection,
} from "@/modules/scripture-references/data/types"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import { filterAndSortReferences } from "@/modules/scripture-references/util/filter-references"
import "./index.css"

const tr = ptr("scriptureReferences.views.index")
const FILTER_PANEL_ANIMATION_MS = 200

type ReferenceDrawerState = { mode: "create" } | { mode: "view"; referenceId: number }

export function ScriptureReferencesView() {
  const navigate = useNavigate()
  const auth = useAuth()
  const supabase = useSupabase()
  const adminReferencesQuery = createAsync(() => getAdminReferences())
  const adminCollectionsQuery = createAsync(() => getAdminCollections())
  const referenceStore = scriptureReferenceStore(supabase.client, { subscribe: false })
  const collectionStore = scriptureCollectionStore(supabase.client, { subscribe: false })
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [drawerState, setDrawerState] = createSignal<ReferenceDrawerState>({ mode: "create" })
  const drawerMode = createMemo(() => drawerState().mode)
  const references = createMemo(() => referenceStore.adminRecords())
  const collections = createMemo(() => collectionStore.adminRecords())
  const viewingReference = createMemo(() => {
    const state = drawerState()
    if (state.mode !== "view") {
      return null
    }

    return references().find(reference => reference.id === state.referenceId) ?? null
  })
  const [searchValue, setSearchValue] = createSignal("")
  const [collectionFilter, setCollectionFilter] = createSignal<string>("all")
  const [sortField, setSortField] = createSignal<ReferenceSortField>("normalized")
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("asc")
  const [filtersOpen, setFiltersOpen] = createSignal(false)
  const [filtersRendered, setFiltersRendered] = createSignal(false)
  const [filtersVisible, setFiltersVisible] = createSignal(false)
  let filtersUnmountTimeout: ReturnType<typeof setTimeout> | null = null
  let filtersOpenAnimationFrame: number | null = null

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
    const result = adminReferencesQuery()
    if (!result?.references) {
      return
    }

    referenceStore.mergeIntoCache(
      result.references.map(reference => ({
        id: String(reference.id),
        book: reference.book,
        chapter: reference.chapter,
        start_verse: reference.startVerse,
        end_verse: reference.endVerse,
        slug: reference.slug,
        created_at: reference.createdAt,
        updated_at: reference.updatedAt,
        collections: reference.collections,
      })),
    )
  })

  createEffect(() => {
    const result = adminCollectionsQuery()?.collections
    if (!result) {
      return
    }

    collectionStore.mergeIntoCache(
      result.map(collection => ({
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
    const result = adminReferencesQuery()
    if (auth.loading() || !auth.isSuperuser() || result === undefined) {
      return
    }

    if (!result.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const collectionOptions = createMemo<SelectOption[]>(() => [
    {
      value: "uncollected",
      label: tr("filters.collection.uncollected"),
    },
    ...collections().map(collection => ({
      value: String(collection.id),
      label: collection.name,
    })),
  ])

  const collectionFilterOptions = createMemo<SelectOption[]>(() => [
    {
      value: "all",
      label: tr("filters.collection.all"),
    },
    ...collectionOptions(),
  ])

  const parsedCollectionFilter = createMemo<ReferenceCollectionFilter>(() => {
    const value = collectionFilter()
    if (value === "all") {
      return "all"
    }

    if (value === "uncollected") {
      return "uncollected"
    }

    const id = Number.parseInt(value, 10)
    return Number.isFinite(id) ? id : "all"
  })

  const defaultDrawerCollectionNames = createMemo(() => {
    const filter = parsedCollectionFilter()
    if (typeof filter !== "number") {
      return []
    }

    const collection = collections().find(item => item.id === filter)
    return collection ? [collection.name] : []
  })

  const hasQueryResult = createMemo(
    () => adminReferencesQuery() !== undefined && adminCollectionsQuery() !== undefined,
  )
  const pageError = createMemo(() => adminReferencesQuery()?.error ?? null)
  const hasFiltersApplied = createMemo(
    () => searchValue().trim().length > 0 || collectionFilter() !== "all",
  )
  const filteredReferences = createMemo(() =>
    filterAndSortReferences(references(), {
      collectionFilter: parsedCollectionFilter(),
      searchQuery: searchValue(),
      sortField: sortField(),
      sortDirection: sortDirection(),
    }),
  )
  const referenceCardLabels = createMemo(() => ({
    uncollected: tr("fields.uncollected"),
    updatedAt: tr("fields.updatedAt"),
    unavailable: tr("values.unavailable"),
    collectionsOverflow: (count: number) => tr("fields.collectionsOverflow", { count }),
    viewCollection: (name: string) => tr("fields.viewCollection", { name }),
  }))
  const summary = createMemo(() =>
    tr("summary", {
      visible: filteredReferences().length,
      total: references().length,
    }),
  )
  const sortOptions = createMemo<SelectOption[]>(() => [
    {
      value: "normalized",
      label: tr("sort.fields.normalized"),
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

    if (references().length === 0) {
      return tr("empty.noReferences")
    }

    return tr("empty.noMatches")
  })

  const openCreateDrawer = () => {
    setDrawerState({ mode: "create" })
    setDrawerOpen(true)
  }

  const openViewDrawer = (reference: AdminReferenceRecord) => {
    setDrawerState({ mode: "view", referenceId: reference.id })
    setDrawerOpen(true)
  }

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open)
  }

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="scripture-references-view">
        <a
          href={pages.scripture}
          class="scripture-references-view-back-link">
          <Icon name="arrow_back" />
          {tr("actions.backToScripture")}
        </a>
        <div class="scripture-references-view-shell">
          <div class="scripture-references-view-header">
            <div class="scripture-references-view-header-copy">
              <h1 class="scripture-references-view-title">{tr("title")}</h1>
              <p class="scripture-references-view-subtitle">{tr("subtitle")}</p>
            </div>
          </div>

          <RequiresSuperUser
            fallback={
              <div class="scripture-references-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            <Show
              when={hasQueryResult()}
              fallback={
                <div class="scripture-references-view-loading-state">
                  <LoadingSpinner size="2rem" />
                  <p>{tr("loading")}</p>
                </div>
              }>
              <div class="scripture-references-view-toolbar">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  class="scripture-references-view-create-button"
                  label={tr("actions.create")}
                  onClick={() => openCreateDrawer()}
                />

                <div class="scripture-references-view-toolbar-controls">
                  <Select
                    options={sortOptions()}
                    value={sortField()}
                    onChange={value => {
                      if (value) {
                        setSortField(value as ReferenceSortField)
                      }
                    }}
                    aria-label={tr("sort.fieldLabel")}
                    containerClass="scripture-references-view-sort-field"
                    triggerClass="scripture-references-view-sort-trigger"
                  />

                  <button
                    type="button"
                    class="scripture-references-view-toolbar-icon-button"
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
                    class="scripture-references-view-toolbar-icon-button"
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
                  class="scripture-references-view-filters-motion"
                  classList={{
                    "is-open": filtersVisible(),
                  }}>
                  <div class="scripture-references-view-filters">
                    <Input
                      label={tr("filters.search.label")}
                      type="search"
                      value={searchValue()}
                      placeholder={tr("filters.search.placeholder")}
                      onInput={event => setSearchValue(event.currentTarget.value)}
                    />
                    <Select
                      label={tr("filters.collection.label")}
                      options={collectionFilterOptions()}
                      value={collectionFilter()}
                      onChange={value => {
                        if (value) {
                          setCollectionFilter(value)
                        }
                      }}
                    />
                    <div class="scripture-references-view-filter-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        label={tr("actions.clearFilters")}
                        disabled={!hasFiltersApplied()}
                        onClick={() => {
                          setSearchValue("")
                          setCollectionFilter("all")
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Show>

              <div class="scripture-references-view-summary">
                <span>{summary()}</span>
              </div>

              <Show
                when={filteredReferences().length > 0}
                fallback={
                  <div class="scripture-references-view-empty-state">{emptyMessage()}</div>
                }>
                <ReferenceCardsGrid
                  references={filteredReferences()}
                  labels={referenceCardLabels()}
                  onSelect={openViewDrawer}
                />
              </Show>
            </Show>
          </RequiresSuperUser>
        </div>

        <ReferenceFormDrawer
          open={drawerOpen()}
          mode={drawerMode()}
          reference={viewingReference()}
          collections={collections()}
          defaultCollectionNames={defaultDrawerCollectionNames()}
          referenceStore={referenceStore}
          collectionStore={collectionStore}
          onOpenChange={handleDrawerOpenChange}
        />
      </main>
    </>
  )
}

export default ScriptureReferencesView
