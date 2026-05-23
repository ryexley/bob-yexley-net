import { slugify } from "@/util/formatters"

const REFERENCE_SLUG_MAX = 96

export function referenceSlugFromNormalized(normalized: string): string {
  return slugify(normalized).trim().slice(0, REFERENCE_SLUG_MAX)
}
