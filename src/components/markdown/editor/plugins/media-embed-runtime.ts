import type { MediaType } from "@/modules/media/filename"
import type { AttachmentStatus } from "@/modules/media/media-store"

export type MediaEmbedPreview = {
  key: string
  mediaType: MediaType
  mimeType?: string
  previewUrl?: string
  posterUrl?: string
  mediaSrc?: string
  status?: AttachmentStatus
  progress?: number
}

export type MediaEmbedRuntime = {
  getPreview: (key: string) => MediaEmbedPreview | null
  subscribe: (listener: () => void) => () => void
  onNodeRemoved?: (key: string) => void
}

type MediaEmbedPreviewSource = {
  key: string
  mediaType?: MediaType
  mimeType?: string
  previewUrl?: string
  posterUrl?: string
  mediaSrc?: string
  status?: AttachmentStatus
  progress?: number
}

export function mediaEmbedPreviewFromAttachment(
  attachment: MediaEmbedPreviewSource,
): MediaEmbedPreview {
  return {
    key: attachment.key,
    mediaType: attachment.mediaType ?? "image",
    mimeType: attachment.mimeType,
    previewUrl: attachment.previewUrl,
    posterUrl: attachment.posterUrl,
    mediaSrc: attachment.mediaSrc,
    status: attachment.status,
    progress: attachment.progress,
  }
}

export function composerMediaEmbedRuntime(instance: {
  attachments: () => MediaEmbedPreviewSource[]
  removeAttachment: (key: string) => unknown
}): MediaEmbedRuntime {
  return {
    getPreview: key => {
      const attachment = instance.attachments().find(item => item.key === key)
      return attachment ? mediaEmbedPreviewFromAttachment(attachment) : null
    },
    subscribe: () => () => {},
    onNodeRemoved: key => {
      void instance.removeAttachment(key)
    },
  }
}

let runtime: MediaEmbedRuntime | null = null
const listeners = new Set<() => void>()

export function setMediaEmbedRuntime(next: MediaEmbedRuntime | null): void {
  runtime = next
  notifyMediaEmbedRuntime()
}

export function getMediaEmbedRuntime(): MediaEmbedRuntime | null {
  return runtime
}

export function notifyMediaEmbedRuntime(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeMediaEmbedRuntime(listener: () => void): () => void {
  listeners.add(listener)
  const nested = runtime?.subscribe(listener)
  return () => {
    listeners.delete(listener)
    nested?.()
  }
}
