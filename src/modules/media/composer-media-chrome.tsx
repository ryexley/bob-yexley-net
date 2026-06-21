import { createMemo, Show, type Accessor } from "solid-js"
import { ptr } from "@/i18n"
import type { Attachment, MediaStore } from "./media-store"
import { ComposerMediaStrip } from "./thumbnail-strip"

const tr = ptr("blips.components.blipEditor")

export type ComposerMediaChromeProps = {
  media: Accessor<MediaStore | null>
  mediaError: Accessor<string | null>
  onPreview: (attachment: Attachment) => void
  /** Override default remove handler (e.g. root blip media-tag sync). */
  onRemoveAttachment?: (key: string) => void | Promise<void>
}

/**
 * Composer media strip + error chrome. Defined at module scope so keystrokes in
 * the markdown editor do not recreate this component type (which was remounting
 * preview `<img>` nodes when it lived inside `EditorControls`).
 */
export function ComposerMediaChrome(props: ComposerMediaChromeProps) {
  const attachments = createMemo(() => props.media()?.attachments() ?? [])

  return (
    <div class="blip-editor-media-chrome">
      <ComposerMediaStrip
        attachments={attachments}
        onRemove={key =>
          void (
            props.onRemoveAttachment ??
            (removedKey => props.media()?.removeAttachment(removedKey))
          )(key)
        }
        onRetry={key => props.media()?.retry(key)}
        onPreview={props.onPreview}
        removeLabel={tr("media.remove")}
        retryLabel={tr("media.retry")}
        previewLabel={tr("media.preview")}
      />
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
