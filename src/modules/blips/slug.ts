import { blipPath, type BlipLinkTarget } from "@/urls"

/**
 * Readable blip URL slugs.
 *
 * These functions are mirrored 1:1 in SQL by the `public.normalize_blip_slug`,
 * `public.blip_slug_source` and `public.derive_blip_slug` functions in
 * `supabase/migrations/20261005003000_add_blip_slugs.sql` (used for the
 * backfill and the insert/update trigger). Keep the two implementations in
 * lockstep: same regexes, same order of operations.
 *
 * Convention:
 * - Source text: the blip's `title` column when set, else the first markdown
 *   heading, else the first sentence of the first non-empty body line, with
 *   markdown/HTML/embeds stripped.
 * - Accents are decomposed (NFKD) and the combining marks dropped, a few
 *   non-decomposable letters are transliterated (ß→ss, æ→ae, ...),
 *   apostrophes are dropped ("Hunter's" → "hunters"), the result is
 *   lowercased and every run of characters outside a-z0-9 becomes one dash.
 * - Hard maximum of 60 characters, cut at whole words: trailing words are
 *   dropped until it fits. Only a single first word longer than 60 is
 *   hard-cut.
 * - An empty result (e.g. a media-only blip) means "no slug": the blip is
 *   linked as `/blips/{id}` and the stored value is NULL.
 */

export const BLIP_SLUG_MAX_LENGTH = 60

const TRANSLITERATIONS: Array<[RegExp, string]> = [
  [/ß/g, "ss"],
  [/[æÆ]/g, "ae"],
  [/[œŒ]/g, "oe"],
  [/[øØ]/g, "o"],
  [/[đĐ]/g, "d"],
  [/[łŁ]/g, "l"],
  [/[þÞ]/g, "th"],
]

/**
 * Normalize arbitrary text to a URL slug. Idempotent: `normalizeBlipSlug(normalizeBlipSlug(x))`
 * equals `normalizeBlipSlug(x)`.
 */
export function normalizeBlipSlug(
  input: string | null | undefined,
  maxLength: number = BLIP_SLUG_MAX_LENGTH,
): string {
  if (!input) {
    return ""
  }

  let value = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  for (const [pattern, replacement] of TRANSLITERATIONS) {
    value = value.replace(pattern, replacement)
  }

  value = value
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return truncateSlug(value, maxLength)
}

/**
 * Cut an already-normalized slug to at most `maxLength` characters on a word
 * (dash) boundary. A first word longer than `maxLength` is hard-cut.
 */
export function truncateSlug(
  slug: string,
  maxLength: number = BLIP_SLUG_MAX_LENGTH,
): string {
  if (slug.length <= maxLength) {
    return slug
  }

  // Longest prefix of at most maxLength characters that is followed by a
  // dash, i.e. ends exactly at the end of a word. Mirrors the SQL
  // `substring(value from '^(.{1,60})-')`.
  const atWordBoundary = slug.match(new RegExp(`^(.{1,${maxLength}})-`))
  const truncated = atWordBoundary
    ? atWordBoundary[1]
    : slug.slice(0, maxLength)
  return truncated.replace(/-+$/g, "")
}

/** Remove markdown/HTML noise that should never end up in a slug. */
function stripMarkup(content: string): string {
  return (
    content
      // fenced code blocks
      .replace(/```[^`]*```/g, " ")
      // custom embeds: {audio:{...}}, {media:{...}}
      .replace(/\{[a-z]+:\{[^}]*\}\}/gi, " ")
      // images
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      // links -> link text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // html tags
      .replace(/<[^>]*>/g, " ")
      // bare urls
      .replace(/https?:\/\/[^\s)]+/g, " ")
  )
}

const LINE_MARKERS =
  /^[ \t]*(#{1,6}[ \t]+|>[ \t]?|[*+-][ \t]+|[0-9]+[.)][ \t]+)+/

/**
 * Source text for a blip's slug: title, else first heading, else first
 * sentence of the first line that has any sluggable text.
 */
export function blipSlugSource(
  title: string | null | undefined,
  content: string | null | undefined,
): string {
  if (title && normalizeBlipSlug(title) !== "") {
    return title
  }

  const cleaned = stripMarkup(content ?? "")

  const heading = cleaned.match(/^#{1,6}[ \t]+(.+)$/m)?.[1]
  if (heading && normalizeBlipSlug(heading) !== "") {
    return heading
  }

  for (const rawLine of cleaned.split(/\r?\n/)) {
    const line = rawLine.replace(LINE_MARKERS, "")
    if (normalizeBlipSlug(line) === "") {
      continue
    }
    // First sentence: cut at the first . ! or ? that ends the line or is
    // followed by whitespace (so "v2.0" or "bob.yexley.net" don't split).
    return line.replace(/[.!?]+(\s.*)?$/, "")
  }

  return ""
}

/** Derive the slug for a blip. Returns "" when no readable slug exists. */
export function deriveBlipSlug(
  blip: { title?: string | null; content?: string | null } | null | undefined,
): string {
  if (!blip) {
    return ""
  }
  return normalizeBlipSlug(blipSlugSource(blip.title, blip.content))
}

/**
 * Decide whether a blip detail request needs a permanent redirect.
 *
 * - `/blips/{id}` (no slug segment) is served as-is (200); its canonical
 *   points at the slug URL.
 * - `/blips/{id}/{slug}` with the blip's current slug is served as-is.
 * - Any other slug (stale, mistyped, wrong case) redirects to
 *   `blipPath(blip)`, i.e. `/blips/{id}/{currentSlug}`, or `/blips/{id}` when
 *   the blip has no slug.
 *
 * Returns the redirect target path, or null when no redirect is needed.
 */
export function resolveBlipSlugRedirect(
  requestedSlug: string | null | undefined,
  blip: BlipLinkTarget | null | undefined,
): string | null {
  if (!blip || requestedSlug === undefined || requestedSlug === null) {
    return null
  }

  const currentSlug = (blip.slug ?? "").trim()
  if (requestedSlug === "" && currentSlug === "") {
    return null
  }

  return requestedSlug === currentSlug ? null : blipPath(blip)
}
