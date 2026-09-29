import { createMemo, Show, type Accessor } from "solid-js"
import { LoadingSpinner } from "@/components/icon"
import { ptr } from "@/i18n"
import type { Attachment, MediaStore } from "./media-store"
import { MEDIA_PLACEMENT } from "./placement"
import { ComposerMediaStrip } from "./thumbnail-strip"

const tr = ptr("blips.components.blipEditor")

export type ComposerMediaChromeProps = {
  media: Accessor<MediaStore | null>
  mediaError: Accessor<string | null>
  onPreview: (attachment: Attachment) => void
  /** Override default remove handler (e.g. root blip media-tag sync). */
  onRemoveAttachment?: (key: string) => void | Promise<void>
}

export type ComposerMediaProgress = {
  kind: "uploading" | "processing" | "saving"
  count: number
}

/** Upload, process, or persist still in flight. Persist failures stop counting as busy. */
export function isBusyAttachment(
  item: Attachment,
  persistFailed = false,
): boolean {
  switch (item.status) {
    case "pending":
    case "uploading":
    case "processing":
      return true
    case "complete":
      return !persistFailed
    default:
      return false
  }
}

export function composerMediaProgress(
  attachments: Attachment[],
  persistFailed = false,
): ComposerMediaProgress | null {
  const busy = attachments.filter(item =>
    isBusyAttachment(item, persistFailed),
  )
  if (busy.length === 0) {
    return null
  }
  if (
    busy.some(
      item => item.status === "pending" || item.status === "uploading",
    )
  ) {
    return { kind: "uploading", count: busy.length }
  }
  if (busy.some(item => item.status === "processing")) {
    return { kind: "processing", count: busy.length }
  }
  return { kind: "saving", count: busy.length }
}

/** True while any attachment (gallery or inline) is still uploading or persisting. */
export function mediaStoreIsBusy(store: MediaStore | null): boolean {
  if (!store) {
    return false
  }
  const persistFailed = Boolean(store.persistError?.())
  return store
    .attachments()
    .some(item => isBusyAttachment(item, persistFailed))
}

/**
 * Composer media strip + error chrome. Defined at module scope so keystrokes in
 * the markdown editor do not recreate this component type (which was remounting
 * preview `<img>` nodes when it lived inside `EditorControls`).
 */
export function ComposerMediaChrome(props: ComposerMediaChromeProps) {
  const attachments = createMemo(() =>
    (props.media()?.attachments() ?? []).filter(
      item => item.placement !== MEDIA_PLACEMENT.Inline,
    ),
  )
  const progress = createMemo(() =>
    composerMediaProgress(
      attachments(),
      Boolean(props.media()?.persistError?.()),
    ),
  )
  const progressLabel = createMemo(() => {
    const next = progress()
    return next ? tr(`media.progress.${next.kind}`, { count: next.count }) : null
  })

  return (
    <div
      class="blip-editor-media-chrome"
      aria-busy={progress() != null}>
      <ComposerMediaStrip
        attachments={attachments}
        onRemove={key => {
          if (props.onRemoveAttachment) {
            void props.onRemoveAttachment(key)
            return
          }

          void props.media()?.removeAttachment(key)
        }}
        onRetry={key => props.media()?.retry(key)}
        onPreview={props.onPreview}
        removeLabel={tr("media.remove")}
        retryLabel={tr("media.retry")}
        previewLabel={tr("media.preview")}
      />
      <Show when={progressLabel()}>
        {label => (
          <div
            class="progress"
            role="status"
            aria-live="polite">
            <LoadingSpinner />
            <span>{label()}</span>
          </div>
        )}
      </Show>
      <Show when={props.mediaError()}>
        <div
          class="blip-editor-media-error"
          role="alert">
          {props.mediaError()}
        </div>
      </Show>
    </div>
  )
}
