import { createAsync, useNavigate, useParams } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, Show, onCleanup } from "solid-js"
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
import { ReferenceCardsGrid } from "@/modules/scripture-references/components/reference-cards-grid"
import { ReferenceFormDrawer } from "@/modules/scripture-references/components/reference-form-drawer"
import {
  getAdminReferences,
  scriptureReferenceStore,
} from "@/modules/scripture-references/data"
import type {
  AdminReferenceRecord,
  ReferenceSortField,
  SortDirection,
} from "@/modules/scripture-references/data/types"
import { filterAndSortReferences } from "@/modules/scripture-references/util/filter-references"
import {
  findCollectionByRouteParam,
  isCanonicalCollectionRouteParam,
} from "@/modules/scripture-collections/util/collection-route"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import "@/modules/scripture-references/views/index.css"
import "./collection.css"

const tr = ptr("scriptureCollections.views.collection")
const referenceTr = ptr("scriptureReferences.views.index")
const FILTER_PANEL_ANIMATION_MS = 200

type ReferenceDrawerState = { mode: "create" } | { mode: "view"; referenceId: number }

export function ScriptureCollectionDetailView() {
  const params = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const supabase = useSupabase()
  const adminCollectionsQuery = createAsync(() => getAdminCollections())
  const adminReferencesQuery = createAsync(() => getAdminReferences())
  const collectionStore = scriptureCollectionStore(supabase.client, { subscribe: false })
  const referenceStore = scriptureReferenceStore(supabase.client, { subscribe: false })
  const [collectionDrawerOpen, setCollectionDrawerOpen] = createSignal(false)
  const [referenceDrawerOpen, setReferenceDrawerOpen] = createSignal(false)
  const [referenceDrawerState, setReferenceDrawerState] = createSignal<ReferenceDrawerState>({
    mode: "create",
  })
  const [searchValue, setSearchValue] = createSignal("")
  const [sortField, setSortField] = createSignal<ReferenceSortField>("normalized")
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("asc")
  const [filtersOpen, setFiltersOpen] = createSignal(false)
  const [filtersRendered, setFiltersRendered] = createSignal(false)
  const [filtersVisible, setFiltersVisible] = createSignal(false)
  let filtersUnmountTimeout: ReturnType<typeof setTimeout> | null = null
  let filtersOpenAnimationFrame: number | null = null

  const collectionRouteParam = createMemo(() => params.slug?.trim() ?? "")
  const [trackedCollectionId, setTrackedCollectionId] = createSignal<number | null>(null)
  const collections = createMemo(() => collectionStore.adminRecords())
  const references = createMemo(() => referenceStore.adminRecords())
  const collection = createMemo(() => {
    const param = collectionRouteParam()
    if (!param) {
      return null
    }

    const byParam = findCollectionByRouteParam(collections(), param)
    if (byParam) {
      return byParam
    }

    const trackedId = trackedCollectionId()
    if (trackedId == null) {
      return null
    }

    return collections().find(item => item.id === trackedId) ?? null
  })
  const referenceDrawerMode = createMemo(() => referenceDrawerState().mode)
  const viewingReference = createMemo(() => {
    const state = referenceDrawerState()
    if (state.mode !== "view") {
      return null
    }

    return references().find(reference => reference.id === state.referenceId) ?? null
  })

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
    const result = adminCollectionsQuery()?.collections
    if (!result) {
      return
    }

    collectionStore.mergeIntoCache(
      result.map(item => ({
        id: String(item.id),
        name: item.name,
        description: item.description,
        slug: item.slug,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        reference_count: item.referenceCount,
      })),
    )
  })

  createEffect(() => {
    const result = adminReferencesQuery()?.references
    if (!result) {
      return
    }

    referenceStore.mergeIntoCache(
      result.map(reference => ({
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
    const collectionsResult = adminCollectionsQuery()
    const referencesResult = adminReferencesQuery()
    if (auth.loading() || !auth.isSuperuser() || collectionsResult === undefined) {
      return
    }

    if (!collectionsResult.authorized || referencesResult?.authorized === false) {
      navigate(pages.login, { replace: true })
    }
  })

  createEffect(() => {
    const currentCollection = collection()
    if (currentCollection) {
      setTrackedCollectionId(currentCollection.id)
    }
  })

  createEffect(() => {
    const collectionsResult = adminCollectionsQuery()
    const referencesResult = adminReferencesQuery()
    const param = collectionRouteParam()

    if (collectionsResult === undefined || referencesResult === undefined || !param) {
      return
    }

    const currentCollection = collection()
    if (currentCollection) {
      if (!isCanonicalCollectionRouteParam(currentCollection, param)) {
        navigate(pages.scriptureCollection(currentCollection.slug), { replace: true })
      }
      return
    }

    navigate(pages.scriptureCollections, { replace: true })
  })

  const hasQueryResult = createMemo(
    () => adminCollectionsQuery() !== undefined && adminReferencesQuery() !== undefined,
  )
  const pageError = createMemo(
    () => adminReferencesQuery()?.error ?? adminCollectionsQuery()?.error ?? null,
  )
  const hasFiltersApplied = createMemo(() => searchValue().trim().length > 0)
  const filteredReferences = createMemo(() => {
    const currentCollection = collection()
    if (!currentCollection) {
      return []
    }

    return filterAndSortReferences(references(), {
      collectionFilter: currentCollection.id,
      searchQuery: searchValue(),
      sortField: sortField(),
      sortDirection: sortDirection(),
    })
  })
  const summary = createMemo(() => {
    const currentCollection = collection()
    if (!currentCollection) {
      return ""
    }

    return tr("summary", {
      visible: filteredReferences().length,
      total: currentCollection.referenceCount,
    })
  })
  const sortOptions = createMemo<SelectOption[]>(() => [
    {
      value: "normalized",
      label: referenceTr("sort.fields.normalized"),
    },
    {
      value: "createdAt",
      label: referenceTr("sort.fields.createdAt"),
    },
  ])
  const referenceCardLabels = createMemo(() => ({
    uncollected: referenceTr("fields.uncollected"),
    updatedAt: referenceTr("fields.updatedAt"),
    unavailable: referenceTr("values.unavailable"),
    collectionsOverflow: (count: number) =>
      referenceTr("fields.collectionsOverflow", { count }),
    viewCollection: (name: string) => referenceTr("fields.viewCollection", { name }),
  }))
  const emptyMessage = createMemo(() => {
    if (pageError()) {
      return pageError()
    }

    const currentCollection = collection()
    if (!currentCollection) {
      return tr("empty.notFound")
    }

    if (currentCollection.referenceCount === 0) {
      return tr("empty.noReferences")
    }

    return tr("empty.noMatches")
  })

  const openCreateReferenceDrawer = () => {
    setReferenceDrawerState({ mode: "create" })
    setReferenceDrawerOpen(true)
  }

  const openViewReferenceDrawer = (reference: AdminReferenceRecord) => {
    setReferenceDrawerState({ mode: "view", referenceId: reference.id })
    setReferenceDrawerOpen(true)
  }

  return (
    <>
      <Title>
        {windowTitle(
          collection()
            ? tr("pageTitle", { name: collection()!.name })
            : tr("loadingPageTitle"),
        )}
      </Title>
      <Meta
        name="description"
        content={
          collection()
            ? tr("metaDescription", { name: collection()!.name })
            : tr("metaDescriptionFallback")
        }
      />
      <main class="scripture-collection-detail-view">
        <a
          href={pages.scriptureCollections}
          class="scripture-collection-detail-view-back-link">
          <Icon name="arrow_back" />
          {tr("actions.backToCollections")}
        </a>
        <div class="scripture-collection-detail-view-shell">
          <Show
            when={collection()}
            fallback={
              <div class="scripture-references-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            {currentCollection => (
              <>
                <div class="scripture-collection-detail-view-header">
                  <button
                    type="button"
                    class="scripture-collection-detail-view-header-copy scripture-collection-detail-view-header-trigger"
                    onClick={() => setCollectionDrawerOpen(true)}>
                    <h1 class="scripture-collection-detail-view-title">
                      {currentCollection().name}
                    </h1>
                    <p class="scripture-collection-detail-view-slug">{currentCollection().slug}</p>
                    <Show when={currentCollection().description}>
                      {description => (
                        <p class="scripture-collection-detail-view-description">
                          {description()}
                        </p>
                      )}
                    </Show>
                  </button>
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
                        label={tr("actions.createReference")}
                        onClick={() => openCreateReferenceDrawer()}
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
                          aria-label={referenceTr("sort.fieldLabel")}
                          containerClass="scripture-references-view-sort-field"
                          triggerClass="scripture-references-view-sort-trigger"
                        />

                        <button
                          type="button"
                          class="scripture-references-view-toolbar-icon-button"
                          aria-label={
                            sortDirection() === "desc"
                              ? referenceTr("sort.direction.desc")
                              : referenceTr("sort.direction.asc")
                          }
                          onClick={() =>
                            setSortDirection(direction =>
                              direction === "desc" ? "asc" : "desc",
                            )
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
                            filtersOpen()
                              ? referenceTr("actions.hideFilters")
                              : referenceTr("actions.showFilters")
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
                            label={referenceTr("filters.search.label")}
                            type="search"
                            value={searchValue()}
                            placeholder={referenceTr("filters.search.placeholder")}
                            onInput={event => setSearchValue(event.currentTarget.value)}
                          />
                          <div class="scripture-references-view-filter-actions">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              label={referenceTr("actions.clearFilters")}
                              disabled={!hasFiltersApplied()}
                              onClick={() => setSearchValue("")}
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
                        onSelect={openViewReferenceDrawer}
                      />
                    </Show>
                  </Show>
                </RequiresSuperUser>
              </>
            )}
          </Show>
        </div>

        <CollectionFormDrawer
          open={collectionDrawerOpen()}
          mode="view"
          collection={collection()}
          store={collectionStore}
          onOpenChange={open => {
            setCollectionDrawerOpen(open)
            if (!open && !collection()) {
              navigate(pages.scriptureCollections, { replace: true })
            }
          }}
        />

        <ReferenceFormDrawer
          open={referenceDrawerOpen()}
          mode={referenceDrawerMode()}
          reference={viewingReference()}
          collections={collections()}
          defaultCollectionNames={
            collection() ? [collection()!.name] : []
          }
          referenceStore={referenceStore}
          collectionStore={collectionStore}
          onOpenChange={setReferenceDrawerOpen}
        />
      </main>
    </>
  )
}

export default ScriptureCollectionDetailView
