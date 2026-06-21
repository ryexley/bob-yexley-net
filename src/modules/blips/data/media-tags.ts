import type { Attachment } from "@/modules/media/media-store"
import type { MediaType } from "@/modules/media/filename"

/** Auto-managed tags derived from attached media types (root blips only). */
export const MEDIA_TYPE_TAG_BY_MEDIA_TYPE = {
  image: "photos",
  video: "videos",
  gif: "gifs",
} as const satisfies Record<MediaType, string>

export type ManagedMediaTagName =
  (typeof MEDIA_TYPE_TAG_BY_MEDIA_TYPE)[MediaType]

export const MANAGED_MEDIA_TAG_NAMES = new Set<string>(
  Object.values(MEDIA_TYPE_TAG_BY_MEDIA_TYPE),
)

export function mediaTypeTagForMediaType(
  mediaType: MediaType,
): ManagedMediaTagName {
  return MEDIA_TYPE_TAG_BY_MEDIA_TYPE[mediaType]
}

/** Tags that should be present given current composer attachments (in-flight + saved). */
export function mediaTypeTagsForAttachments(
  attachments: Pick<Attachment, "mediaType" | "status">[],
): ManagedMediaTagName[] {
  const tags = new Set<ManagedMediaTagName>()

  for (const attachment of attachments) {
    if (attachment.status === "error" || !attachment.mediaType) {
      continue
    }
    tags.add(mediaTypeTagForMediaType(attachment.mediaType))
  }

  return [...tags].sort()
}

/**
 * Sync the three media-type tags with attachment state while preserving all
 * other tags the author selected manually.
 */
export function reconcileTagsWithMediaTypes(
  currentTags: string[],
  presentMediaTypeTags: string[],
): string[] {
  const nonMediaTags = currentTags.filter(
    tag => !MANAGED_MEDIA_TAG_NAMES.has(tag),
  )
  const mediaTags = [...new Set(presentMediaTypeTags)].sort()

  return [...nonMediaTags, ...mediaTags].sort()
}
