import { createEffect, createMemo, createSignal, Index, on, Show, type Accessor } from "solid-js"
import type { Attachment } from "./media-store"
import { MediaThumbnail } from "./media-thumbnail"

export type ThumbnailStripProps = {
  attachments: Accessor<Attachment[]>
  onRemove: (key: string) => void
  onRetry: (key: string) => void
  onPreview: (attachment: Attachment) => void
  removeLabel: string
  retryLabel: string
  previewLabel: string
}

export type ComposerMediaStripProps = Omit<ThumbnailStripProps, "attachments"> & {
  attachments: Accessor<Attachment[]>
}

/**
 * Composer-only wrapper: hidden when there are no attachments.
 */
export function ComposerMediaStrip(props: ComposerMediaStripProps) {
  return (
    <Show when={props.attachments().length > 0}>
      <ThumbnailStrip
        attachments={props.attachments}
        onRemove={props.onRemove}
        onRetry={props.onRetry}
        onPreview={props.onPreview}
        removeLabel={props.removeLabel}
        retryLabel={props.retryLabel}
        previewLabel={props.previewLabel}
      />
    </Show>
  )
}

/**
 * One tile keyed by `storage_key` so parent re-renders do not remount the preview
 * `<img>` when the attachment object reference changes.
 */
function MediaThumbnailTile(
  props: ThumbnailStripProps & { storageKey: string },
) {
  const attachment = createMemo(
    () => props.attachments().find(item => item.key === props.storageKey),
  )

  return (
    <Show when={attachment()}>
      {item => (
        <MediaThumbnail
          attachment={item()}
          onRemove={props.onRemove}
          onRetry={props.onRetry}
          onPreview={props.onPreview}
          removeLabel={props.removeLabel}
          retryLabel={props.retryLabel}
          previewLabel={props.previewLabel}
        />
      )}
    </Show>
  )
}

/**
 * Horizontally scrolling composer media strip (spec §11.3).
 *
 * Keys tiles by `storage_key` and resolves attachment data through an accessor so
 * editor keystrokes do not remount preview images.
 */
export function ThumbnailStrip(props: ThumbnailStripProps) {
  const keys = createMemo(() => props.attachments().map(item => item.key))
  const [stripEl, setStripEl] = createSignal<HTMLDivElement | undefined>()

  const scrollStripToEnd = (): void => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const strip = stripEl()
        if (!strip) {
          return
        }
        const lastItem = strip.lastElementChild
        if (lastItem instanceof HTMLElement) {
          lastItem.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "end",
          })
          return
        }
        strip.scrollTo({ left: strip.scrollWidth, behavior: "smooth" })
      })
    })
  }

  createEffect(
    on(keys, (nextKeys, previousKeys) => {
      if (!previousKeys || nextKeys.length <= previousKeys.length) {
        return
      }

      const appendedAtEnd =
        previousKeys.length < nextKeys.length &&
        previousKeys.every((key, index) => nextKeys[index] === key)

      if (appendedAtEnd) {
        scrollStripToEnd()
      }
    }),
  )

  return (
    <Show when={keys().length > 0}>
      <div
        ref={setStripEl}
        class="media-thumbnail-strip thin-scrollbar"
        role="list">
        <Index each={keys()}>
          {storageKey => (
            <div
              class="media-thumbnail-strip-item"
              role="listitem">
              <MediaThumbnailTile
                {...props}
                storageKey={storageKey()}
              />
            </div>
          )}
        </Index>
      </div>
    </Show>
  )
}
