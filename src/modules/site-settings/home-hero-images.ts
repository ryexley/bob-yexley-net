export const HOME_HERO_IMAGES_SETTING_KEY = "home.heroImageIds"

export const MAX_HOME_HERO_IMAGES = 24
export const MAX_HOME_HERO_IMAGE_ID_LENGTH = 200

/**
 * Fallback used when the `home.heroImageIds` setting is missing or invalid.
 * Keep in sync with the seed in
 * `supabase/migrations/20261019210000_site_settings_table.sql`.
 */
export const DEFAULT_HOME_HERO_IMAGE_IDS: readonly string[] = [
  "green-trees-with-mountain-on-the-horizon-high-angle-photography-dtxihV-sX8k",
  "green-forest-near-mountain-2z2CGEB7FIk",
  "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
]

export const parseHeroImageIdInput = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const withoutHash = trimmed.split("#")[0]?.trim() ?? ""
  if (!withoutHash) {
    return null
  }

  const candidate =
    extractPathSlug(withoutHash) ?? withoutHash.split("?")[0]?.trim()
  if (!candidate) {
    return null
  }

  if (candidate.length > MAX_HOME_HERO_IMAGE_ID_LENGTH) {
    return null
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(candidate)) {
    return null
  }

  return candidate
}

export const parseHeroImageIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  const ids = normalizeHeroImageIds(value)
  return ids.length > 0 ? ids : null
}

export const normalizeHeroImageIds = (values: unknown[]): string[] => {
  const seen = new Set<string>()
  const ids: string[] = []

  for (const value of values) {
    if (typeof value !== "string") {
      continue
    }

    const id = parseHeroImageIdInput(value)
    if (!id || seen.has(id)) {
      continue
    }

    seen.add(id)
    ids.push(id)
  }

  return ids
}

export const sameHeroImageIds = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index])

const extractPathSlug = (value: string): string | null => {
  const withProtocol = value.startsWith("//") ? `https:${value}` : value
  if (!withProtocol.includes("://")) {
    return null
  }

  try {
    const url = new URL(withProtocol)
    const segments = url.pathname.split("/").filter(Boolean)
    const last = segments[segments.length - 1]
    return last ? last.trim() : null
  } catch {
    return null
  }
}
