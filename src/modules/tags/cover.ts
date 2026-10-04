/**
 * Resolve a stored tag cover (`tags.cover_image`) to a public URL.
 *
 * The column holds either an absolute http(s) URL or an R2 object key relative
 * to the public media base URL (`VITE_MEDIA_STORAGE_URL`), e.g.
 * `media/{userId}/tags/faith-20261004.jpg`.
 */
export function resolveTagCoverUrl(
  value: string | null | undefined,
  baseUrl: string | undefined = import.meta.env.VITE_MEDIA_STORAGE_URL as string | undefined,
): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const base = (baseUrl ?? "").trim().replace(/\/+$/, "")
  if (!base) {
    return null
  }

  return `${base}/${trimmed.replace(/^\/+/, "")}`
}
