import { slugify } from "@/util/formatters"

const COLLECTION_SLUG_MAX = 96

export function collectionSlugFromName(name: string): string {
  return slugify(name).trim().slice(0, COLLECTION_SLUG_MAX)
}
