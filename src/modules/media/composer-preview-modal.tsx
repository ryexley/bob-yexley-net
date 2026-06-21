import { Show, createMemo, createSignal } from "solid-js"
import { Dialog, DialogCloseButton } from "@/components/dialog"
import { ImagePlaceholder } from "@/components/icon"
import type { Attachment } from "./media-store"
import { MediaVariant, originalUrl, variantUrl } from "./media-utils"

export type ComposerPreviewModalProps = {
  attachment: Attachment | null
  onClose: () => void
  closeLabel: string
}

/**
 * Build the ordered list of image sources to try for a single attachment,
 * largest-first with graceful 404 fallback to the original / live preview. Full
 * variant-aware rendering for committed rows lands with `PersonalCloudImage` in
 * the reader phases; the composer preview only needs a best-effort large image.
 */
const imageCandidates = (attachment: Attachment): string[] => {
  const record = attachment.record
  const candidates: string[] = []

  if (record && record.media_type === "image") {
    if (record.processing_status === "complete") {
      candidates.push(
        variantUrl(record.storage_key, MediaVariant.Large),
        variantUrl(record.storage_key, MediaVariant.Medium),
      )
    }
    candidates.push(originalUrl(record.storage_key, record.mime_type))
  }

  if (attachment.previewUrl) {
    candidates.push(attachment.previewUrl)
  }

  return [...new Set(candidates)]
}

const videoSrc = (attachment: Attachment): string | undefined => {
  if (attachment.mediaSrc) {
    return attachment.mediaSrc
  }
  const record = attachment.record
  if (record) {
    return originalUrl(record.storage_key, record.mime_type)
  }
  return attachment.previewUrl
}

/**
 * Single-item preview (spec §11.3 "tap to preview"). Opened by tapping a
 * thumbnail; deliberately no carousel — multi-item navigation is the Phase 6
 * lightbox.
 */
export function ComposerPreviewModal(props: ComposerPreviewModalProps) {
  const [candidateIndex, setCandidateIndex] = createSignal(0)

  const isVideo = () => props.attachment?.mediaType === "video"

  const candidates = createMemo(() =>
    props.attachment && !isVideo() ? imageCandidates(props.attachment) : [],
  )

  const currentSrc = createMemo(() => {
    const list = candidates()
    const index = candidateIndex()
    return index < list.length ? list[index] : undefined
  })

  return (
    <Dialog
      open={props.attachment != null}
      onOpenChange={open => {
        if (!open) {
          setCandidateIndex(0)
          props.onClose()
        }
      }}
      modal
      preventScroll
      overlayClass="composer-preview-overlay"
      class="composer-preview-dialog">
      <div class="composer-preview-body">
        <Show
          when={props.attachment}
          fallback={null}>
          {attachment => (
            <div class="composer-preview-frame">
              <Show
                when={isVideo()}
                fallback={
                  <Show
                    when={currentSrc()}
                    fallback={
                      <span class="composer-preview-placeholder">
                        <ImagePlaceholder />
                      </span>
                    }>
                    <img
                      class="composer-preview-media"
                      src={currentSrc()}
                      alt=""
                      onError={() =>
                        setCandidateIndex(index => index + 1)
                      }
                    />
                  </Show>
                }>
                <video
                  class="composer-preview-media"
                  src={videoSrc(attachment())}
                  controls
                  playsinline
                  preload="metadata">
                  <track kind="captions" />
                </video>
              </Show>
              <DialogCloseButton
                class="composer-preview-close"
                aria-label={props.closeLabel}
              />
            </div>
          )}
        </Show>
      </div>
    </Dialog>
  )
}
