import {
  findMediaEmbedRegions,
  parseMediaEmbedBlock,
} from "@/components/markdown/media/media-embed-syntax"

/**
 * Where a `blip_media` row is shown: the composer/detail gallery strip, or
 * inline in the blip markdown body. Missing/unknown values are treated as
 * gallery so pre-column rows and partial test fixtures keep working.
 */
export const MEDIA_PLACEMENT = {
  Gallery: "gallery",
  Inline: "inline",
} as const

export type MediaPlacement =
  (typeof MEDIA_PLACEMENT)[keyof typeof MEDIA_PLACEMENT]

export type MediaPlacementRecord = {
  placement?: string | null
}

export const isGalleryPlacement = (record: MediaPlacementRecord): boolean =>
  record.placement !== MEDIA_PLACEMENT.Inline

export const isInlinePlacement = (record: MediaPlacementRecord): boolean =>
  record.placement === MEDIA_PLACEMENT.Inline

export const inlineMediaKeys = (content: string): Set<string> => {
  const keys = new Set<string>()
  for (const region of findMediaEmbedRegions(content)) {
    const embed = parseMediaEmbedBlock(region.block.raw)
    if (embed?.key) {
      keys.add(embed.key)
    }
  }
  return keys
}

/**
 * Prefer the explicit database placement, but also honor the document itself.
 * The latter prevents an inline embed from rendering a second time as gallery
 * media when a legacy or partially-saved row still has gallery placement.
 */
export const galleryMedia = <
  T extends MediaPlacementRecord & {
    storage_key?: string | null
  },
>(
  rows: T[],
  content = "",
): T[] => {
  const embeddedKeys = inlineMediaKeys(content)
  return rows.filter(
    record =>
      isGalleryPlacement(record) &&
      (!record.storage_key || !embeddedKeys.has(record.storage_key)),
  )
}

export const parseMediaPlacement = (value: unknown): MediaPlacement =>
  value === MEDIA_PLACEMENT.Inline
    ? MEDIA_PLACEMENT.Inline
    : MEDIA_PLACEMENT.Gallery
