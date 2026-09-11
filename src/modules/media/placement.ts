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

export const galleryMedia = <T extends MediaPlacementRecord>(rows: T[]): T[] =>
  rows.filter(isGalleryPlacement)

export const parseMediaPlacement = (value: unknown): MediaPlacement =>
  value === MEDIA_PLACEMENT.Inline
    ? MEDIA_PLACEMENT.Inline
    : MEDIA_PLACEMENT.Gallery
