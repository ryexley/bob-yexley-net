import { For, Show } from "solid-js"
import { Icon } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { Tooltip } from "@/components/tooltip"
import type {
  AdminReferenceCollection,
  AdminReferenceRecord,
} from "@/modules/scripture-references/data/types"
import { pages } from "@/urls"
import { formatLongDate } from "@/util/formatters"
import "./reference-cards-grid.css"

export type ReferenceCardsGridLabels = {
  uncollected: string
  updatedAt: string
  unavailable: string
  edit: string
  remove: string
  removing: string
  collectionsOverflow: (count: number) => string
  viewCollection: (name: string) => string
}

type ReferenceCardsGridProps = {
  references: AdminReferenceRecord[]
  deletingReferenceId: number | null
  labels: ReferenceCardsGridLabels
  onEdit: (reference: AdminReferenceRecord) => void
  onDelete: (reference: AdminReferenceRecord) => void
}

const collectionHref = (collection: AdminReferenceCollection) =>
  collection.slug
    ? pages.scriptureCollection(collection.slug)
    : pages.scriptureCollectionById(collection.id)

function CollectionBadge(props: {
  collection: AdminReferenceCollection
  viewCollectionLabel: string
}) {
  return (
    <a
      href={collectionHref(props.collection)}
      class="scripture-references-view-collection-badge"
      aria-label={props.viewCollectionLabel}
      onClick={event => event.stopPropagation()}>
      {props.collection.name}
    </a>
  )
}

export function ReferenceCardsGrid(props: ReferenceCardsGridProps) {
  return (
    <div class="scripture-references-view-list">
      <For each={props.references}>
        {reference => (
          <article class="scripture-references-view-card">
            <div class="scripture-references-view-card-header">
              <div class="scripture-references-view-card-copy">
                <h2 class="scripture-references-view-card-reference">
                  {reference.normalized}
                </h2>
                <p class="scripture-references-view-card-slug-line">
                  <span class="scripture-references-view-card-slug">{reference.slug}</span>
                </p>
              </div>
              <div class="scripture-references-view-card-badges">
                <Show
                  when={reference.collections.length > 0}
                  fallback={
                    <span
                      class="scripture-references-view-collection-badge"
                      data-uncollected="true">
                      {props.labels.uncollected}
                    </span>
                  }>
                  <CollectionBadge
                    collection={reference.collections[0]}
                    viewCollectionLabel={props.labels.viewCollection(
                      reference.collections[0].name,
                    )}
                  />
                  <Show when={reference.collections.length > 1}>
                    <Tooltip
                      placement="bottom"
                      openDelay={200}
                      contentClass="scripture-references-view-collection-tooltip"
                      triggerClass="scripture-references-view-collection-badge scripture-references-view-collection-badge-overflow"
                      triggerProps={{
                        "aria-label": props.labels.collectionsOverflow(
                          reference.collections.length,
                        ),
                      }}
                      content={() => (
                        <ul class="scripture-references-view-collection-tooltip-list">
                          <For each={reference.collections}>
                            {collection => (
                              <li>
                                <a
                                  href={collectionHref(collection)}
                                  class="scripture-references-view-collection-tooltip-link"
                                  aria-label={props.labels.viewCollection(collection.name)}
                                  onClick={event => event.stopPropagation()}>
                                  {collection.name}
                                </a>
                              </li>
                            )}
                          </For>
                        </ul>
                      )}>
                      <Icon name="more_horiz" />
                    </Tooltip>
                  </Show>
                </Show>
              </div>
            </div>
            <div class="scripture-references-view-card-footer">
              <div class="scripture-references-view-card-updated">
                <span class="scripture-references-view-card-updated-label">
                  {props.labels.updatedAt}
                </span>
                <span class="scripture-references-view-card-updated-value">
                  {formatLongDate(reference.updatedAt) ?? props.labels.unavailable}
                </span>
              </div>
              <div class="scripture-references-view-card-actions">
                <IconButton
                  size="xs"
                  icon="edit"
                  class="scripture-references-view-edit-button"
                  aria-label={props.labels.edit}
                  disabled={props.deletingReferenceId !== null}
                  onClick={() => props.onEdit(reference)}
                />
                <IconButton
                  size="xs"
                  icon="delete"
                  class="scripture-references-view-delete-button"
                  aria-label={
                    props.deletingReferenceId === reference.id
                      ? props.labels.removing
                      : props.labels.remove
                  }
                  disabled={props.deletingReferenceId !== null}
                  onClick={() => props.onDelete(reference)}
                />
              </div>
            </div>
          </article>
        )}
      </For>
    </div>
  )
}
