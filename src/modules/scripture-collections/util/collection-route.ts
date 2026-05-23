import type { AdminCollectionRecord } from "@/modules/scripture-collections/data/types"

export function findCollectionByRouteParam(
  collections: AdminCollectionRecord[],
  param: string,
): AdminCollectionRecord | null {
  const value = param.trim()
  if (!value) {
    return null
  }

  const bySlug = collections.find(collection => collection.slug === value)
  if (bySlug) {
    return bySlug
  }

  if (/^\d+$/.test(value)) {
    const id = Number.parseInt(value, 10)
    return collections.find(collection => collection.id === id) ?? null
  }

  return null
}

export function isCanonicalCollectionRouteParam(
  collection: AdminCollectionRecord,
  param: string,
): boolean {
  return collection.slug === param.trim()
}
