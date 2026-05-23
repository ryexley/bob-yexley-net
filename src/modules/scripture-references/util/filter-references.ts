import type {
  AdminReferenceRecord,
  ReferenceCollectionFilter,
  ReferenceSortField,
  SortDirection,
} from "@/modules/scripture-references/data/types"

type FilterReferencesOptions = {
  collectionFilter?: ReferenceCollectionFilter
  searchQuery?: string
  sortField: ReferenceSortField
  sortDirection: SortDirection
}

export function filterAndSortReferences(
  references: AdminReferenceRecord[],
  options: FilterReferencesOptions,
): AdminReferenceRecord[] {
  const query = options.searchQuery?.trim().toLowerCase() ?? ""
  const collectionFilter = options.collectionFilter ?? "all"
  const { sortField, sortDirection } = options

  const filtered = references.filter(reference => {
    const matchesCollection =
      collectionFilter === "all" ||
      (collectionFilter === "uncollected" && reference.collections.length === 0) ||
      (typeof collectionFilter === "number" &&
        reference.collections.some(collection => collection.id === collectionFilter))

    if (!matchesCollection) {
      return false
    }

    if (query.length === 0) {
      return true
    }

    return (
      reference.normalized.toLowerCase().includes(query) ||
      reference.book.toLowerCase().includes(query) ||
      reference.collections.some(collection =>
        collection.name.toLowerCase().includes(query),
      )
    )
  })

  const multiplier = sortDirection === "asc" ? 1 : -1

  return [...filtered].sort((left, right) => {
    if (sortField === "createdAt") {
      return (
        (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) *
        multiplier
      )
    }

    return (
      left.normalized.localeCompare(right.normalized, undefined, {
        sensitivity: "base",
      }) * multiplier
    )
  })
}
