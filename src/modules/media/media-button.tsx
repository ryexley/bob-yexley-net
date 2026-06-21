import { IconButton } from "@/components/icon-button"

export type MediaButtonProps = {
  onFiles: (files: File[]) => void
  label: string
  onMouseDown?: (event: MouseEvent | TouchEvent) => void
  disabled?: boolean
}

/**
 * Accepted upload types (spec §2), expressed as an `accept` attribute. On mobile
 * the OS file picker already surfaces Camera / Photo Library / Files for these
 * image/video types, so the native picker covers spec §11.2's sources.
 *
 * NOTE: a dedicated mobile `Drawer` action sheet (spec §11.2) is deferred — it
 * needs to render outside the editor's modal `Dialog` focus scope to surface
 * reliably, which is a focused follow-up.
 */
const ACCEPT_ALL =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm"

/**
 * Composer media trigger (spec §11.2): clicking opens the native file picker.
 * Selected files are handed up via `onFiles`; the caller validates them and
 * calls `mediaStore.attach`.
 */
export function MediaButton(props: MediaButtonProps) {
  let input: HTMLInputElement | undefined

  const emit = (element: HTMLInputElement) => {
    const files = element.files ? Array.from(element.files) : []
    // Reset so re-selecting the same file fires a fresh change event.
    element.value = ""
    if (files.length > 0) {
      props.onFiles(files)
    }
  }

  return (
    <>
      <IconButton
        size="xs"
        icon="perm_media"
        class="blip-editor-media-button"
        aria-label={props.label}
        disabled={props.disabled}
        onClick={() => input?.click()}
        onMouseDown={props.onMouseDown}
      />
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT_ALL}
        class="media-button-input"
        tabindex="-1"
        aria-hidden="true"
        onChange={event => emit(event.currentTarget)}
      />
    </>
  )
}
