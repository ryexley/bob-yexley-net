import { createMemo, createSignal, Show } from "solid-js"
import { Button } from "@/components/button"
import { useAuth } from "@/context/auth-context"
import { mimeTypeToExtension } from "@/modules/media/media-utils"
import { r2Service } from "@/modules/media/r2-service"
import { resolveTagCoverUrl } from "@/modules/tags/cover"
import { ptr } from "@/i18n"
import "./tag-cover-upload.css"

const tr = ptr("tags.components.tagCoverUpload")

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Build the R2 key for a tag cover. `/api/media/sign` only signs keys under
 * the caller's own `media/{userId}/` namespace, so covers live at
 * `media/{userId}/tags/{tagName}-{timestamp}.{ext}`.
 */
export const buildTagCoverKey = (
  userId: string,
  tagName: string,
  mimeType: string,
  now: Date = new Date(),
): string => {
  const safeName =
    tagName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14)
  return `media/${userId}/tags/${safeName}-${stamp}.${mimeTypeToExtension(mimeType)}`
}

type TagCoverUploadProps = {
  tagName: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onUploadingChange?: (uploading: boolean) => void
}

export function TagCoverUpload(props: TagCoverUploadProps) {
  const auth = useAuth()
  const [isUploading, setIsUploading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  let fileInput: HTMLInputElement | undefined

  const previewUrl = createMemo(() => resolveTagCoverUrl(props.value))

  const setUploading = (value: boolean) => {
    setIsUploading(value)
    props.onUploadingChange?.(value)
  }

  const handleFile = async (file: File | undefined) => {
    setError(null)
    if (!file) {
      return
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(tr("errors.type"))
      return
    }

    if (file.size > MAX_BYTES) {
      setError(tr("errors.size"))
      return
    }

    const userId = auth.user()?.id
    if (!userId) {
      setError(tr("errors.auth"))
      return
    }

    setUploading(true)
    try {
      const key = buildTagCoverKey(userId, props.tagName, file.type)
      await r2Service.uploadObject({ key, body: file, contentType: file.type })
      props.onChange(key)
    } catch (uploadError) {
      console.error("Tag cover upload failed:", uploadError)
      setError(tr("errors.upload"))
    } finally {
      setUploading(false)
      if (fileInput) {
        fileInput.value = ""
      }
    }
  }

  return (
    <div class="tag-cover-upload">
      <Show when={previewUrl()}>
        {url => (
          <img
            src={url()}
            alt={tr("previewAlt", { tagName: props.tagName })}
            class="tag-cover-upload-preview"
          />
        )}
      </Show>
      <input
        ref={element => (fileInput = element)}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        class="tag-cover-upload-input"
        disabled={props.disabled || isUploading()}
        onChange={event => void handleFile(event.currentTarget.files?.[0])}
      />
      <div class="tag-cover-upload-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          label={isUploading() ? tr("actions.uploading") : tr("actions.upload")}
          disabled={props.disabled || isUploading()}
          onClick={() => fileInput?.click()}
        />
        <Show when={props.value}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            label={tr("actions.remove")}
            disabled={props.disabled || isUploading()}
            onClick={() => props.onChange("")}
          />
        </Show>
      </div>
      <Show when={error()}>
        {message => <p class="tag-cover-upload-error">{message()}</p>}
      </Show>
    </div>
  )
}
