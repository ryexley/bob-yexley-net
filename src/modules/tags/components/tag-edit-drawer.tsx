import { createEffect, createMemo, createSignal, untrack } from "solid-js"
import { Button } from "@/components/button"
import { FormDrawer } from "@/components/form-drawer"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
import { updateAdminTagRecord } from "@/modules/tags/data/client"
import type { AdminTagRecord } from "@/modules/tags/data/types"
import { ptr } from "@/i18n"
import { formatLongDate } from "@/util/formatters"
import "./tag-edit-drawer.css"

const tr = ptr("tags.components.tagEditDrawer")

type TagEditDrawerProps = {
  open: boolean
  tag: AdminTagRecord | null
  onOpenChange: (open: boolean) => void
  onSaved: (tag: AdminTagRecord) => void
  onConflict: (conflictingTagId: string, attemptedName: string) => void
}

const TAG_EDIT_FORM_ID = "tag-edit-drawer-form"

export function TagEditDrawer(props: TagEditDrawerProps) {
  const notify = useNotify()
  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [coverImage, setCoverImage] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)
  const [mountedTag, setMountedTag] = createSignal<AdminTagRecord | null>(
    untrack(() => props.tag),
  )

  const currentTag = createMemo(() => props.tag ?? mountedTag())
  const createdAt = createMemo(() => {
    const timestamp = currentTag()?.createdAt
    return timestamp ? formatLongDate(timestamp) ?? tr("values.unavailable") : tr("values.unavailable")
  })
  const updatedAt = createMemo(() => {
    const timestamp = currentTag()?.updatedAt
    return timestamp ? formatLongDate(timestamp) ?? tr("values.unavailable") : tr("values.unavailable")
  })
  const isDirty = createMemo(() => {
    const tag = currentTag()
    if (!tag) {
      return false
    }

    return (
      name() !== tag.name ||
      description() !== (tag.description ?? "") ||
      coverImage() !== (tag.coverImage ?? "")
    )
  })

  const resetForm = () => {
    setName(currentTag()?.name ?? "")
    setDescription(currentTag()?.description ?? "")
    setCoverImage(currentTag()?.coverImage ?? "")
  }

  createEffect(() => {
    const tag = props.tag
    if (tag) {
      setMountedTag(tag)
    }
  })

  createEffect(() => {
    void currentTag()?.id
    if (props.open) {
      resetForm()
    }
  })

  createEffect(() => {
    if (!props.open) {
      resetForm()
    }
  })

  const handleSave = async (event: Event) => {
    event.preventDefault()

    const tag = currentTag()
    if (!tag || isSaving() || !isDirty()) {
      return
    }

    setIsSaving(true)
    const result = await updateAdminTagRecord(tag.id, {
      name: name(),
      description: description() || null,
      coverImage: coverImage() || null,
    })
    setIsSaving(false)

    if (!result.success) {
      if (result.conflictingTagId) {
        props.onConflict(result.conflictingTagId, name())
        return
      }

      notify.error({
        title: tr("notifications.saveError"),
        content: result.error ?? tr("notifications.saveError"),
      })
      return
    }

    if (result.data) {
      props.onSaved(result.data)
    }
    props.onOpenChange(false)
    notify.success({
      content: tr("notifications.saveSuccess"),
    })
  }

  return (
    <FormDrawer
      open={props.open}
      onOpenChange={open => props.onOpenChange(open)}
      title={tr("title")}
      closeAriaLabel={tr("actions.close")}
      class="tag-edit-drawer"
      when={Boolean(currentTag())}
      canDismiss={() => !isSaving()}
      onClosed={() => setMountedTag(null)}
      actionsClass="form-drawer-actions tag-edit-drawer-actions"
      actions={
        <>
          <Button
            type="submit"
            form={TAG_EDIT_FORM_ID}
            variant="primary"
            size="sm"
            label={isSaving() ? tr("actions.saving") : tr("actions.save")}
            disabled={isSaving() || !isDirty()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            label={tr("actions.cancel")}
            onClick={() => props.onOpenChange(false)}
            disabled={isSaving()}
          />
        </>
      }>
      <div class="tag-edit-drawer-summary">
        <div class="tag-edit-drawer-summary-header">
          <h3>{currentTag()?.name}</h3>
          <div class="tag-edit-drawer-summary-meta">
            <span>{currentTag()?.blipCount ?? 0} blips</span>
          </div>
        </div>
      </div>

      <form
        id={TAG_EDIT_FORM_ID}
        class="tag-edit-drawer-form"
        onSubmit={event => void handleSave(event)}>
        <div class="tag-edit-drawer-details">
          <p class="tag-edit-drawer-detail-line">
            <span class="tag-edit-drawer-detail-label">{tr("fields.createdAt")}:</span>{" "}
            {createdAt()}
          </p>
          <p class="tag-edit-drawer-detail-line">
            <span class="tag-edit-drawer-detail-label">{tr("fields.updatedAt")}:</span>{" "}
            {updatedAt()}
          </p>
        </div>

        <div class="tag-edit-drawer-fieldset">
          <Input
            label={tr("fields.name.label")}
            type="text"
            value={name()}
            onInput={event => setName(event.currentTarget.value)}
            placeholder={tr("fields.name.placeholder")}
            disabled={isSaving()}
          />
          <span class="tag-edit-drawer-field-hint">{tr("fields.name.hint")}</span>
        </div>

        <div class="tag-edit-drawer-fieldset">
          <label class="tag-edit-drawer-notes-field">
            <span class="tag-edit-drawer-notes-label">{tr("fields.description.label")}</span>
            <textarea
              class="tag-edit-drawer-notes-input"
              value={description()}
              rows={4}
              disabled={isSaving()}
              placeholder={tr("fields.description.placeholder")}
              onInput={event => setDescription(event.currentTarget.value)}
            />
            <span class="tag-edit-drawer-field-hint">{tr("fields.description.hint")}</span>
          </label>
        </div>

        <div class="tag-edit-drawer-fieldset">
          <Input
            label={tr("fields.coverImage.label")}
            type="url"
            value={coverImage()}
            onInput={event => setCoverImage(event.currentTarget.value)}
            placeholder={tr("fields.coverImage.placeholder")}
            disabled={isSaving()}
          />
          <span class="tag-edit-drawer-field-hint">{tr("fields.coverImage.hint")}</span>
        </div>
      </form>
    </FormDrawer>
  )
}
