import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Button } from "@/components/button"
import { FormDrawer } from "@/components/form-drawer"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
import { useConfirm } from "@/components/confirm-dialog"
import type { scriptureCollectionStore } from "@/modules/scripture-collections/data/store"
import { collectionSlugFromName } from "@/modules/scripture-collections/util/collection-slug"
import type { AdminCollectionRecord } from "@/modules/scripture-collections/data/types"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { formatLongDate } from "@/util/formatters"
import "./collection-form-drawer.css"

const tr = ptr("scriptureCollections.components.collectionFormDrawer")

type CollectionFormDrawerMode = "create" | "view"

type CollectionStore = ReturnType<typeof scriptureCollectionStore>

type CollectionFormDrawerProps = {
  open: boolean
  mode: CollectionFormDrawerMode
  collection: AdminCollectionRecord | null
  store: CollectionStore
  onOpenChange: (open: boolean) => void
}

const COLLECTION_FORM_ID = "collection-form-drawer-form"

export function CollectionFormDrawer(props: CollectionFormDrawerProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isEditing, setIsEditing] = createSignal(false)
  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [slug, setSlug] = createSignal("")
  const [slugManuallyEdited, setSlugManuallyEdited] = createSignal(false)
  const [isSaving, setIsSaving] = createSignal(false)
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [mountedCollection, setMountedCollection] =
    createSignal<AdminCollectionRecord | null>(props.collection)

  const currentCollection = createMemo(() => props.collection ?? mountedCollection())
  const isFormMode = createMemo(() => props.mode === "create" || isEditing())
  const drawerTitle = createMemo(() => {
    if (props.mode === "create") {
      return tr("title.create")
    }

    return isEditing() ? tr("title.edit") : tr("title.view")
  })
  const isDirty = createMemo(() => {
    if (props.mode === "create") {
      return (
        name().trim().length > 0 ||
        description().trim().length > 0 ||
        slug().trim().length > 0
      )
    }

    const collection = currentCollection()
    if (!collection || !isEditing()) {
      return false
    }

    return (
      name() !== collection.name ||
      description() !== (collection.description ?? "") ||
      slug() !== collection.slug
    )
  })
  const canSave = createMemo(() => {
    return (
      name().trim().length > 0 &&
      slug().trim().length > 0 &&
      isDirty() &&
      !isSaving() &&
      !isDeleting()
    )
  })

  const resetForm = () => {
    if (props.mode === "create") {
      setName("")
      setDescription("")
      setSlug("")
      setSlugManuallyEdited(false)
      return
    }

    const collection = currentCollection()
    setName(collection?.name ?? "")
    setDescription(collection?.description ?? "")
    setSlug(collection?.slug ?? "")
    setSlugManuallyEdited(false)
  }

  const resetEditingState = () => {
    setIsEditing(false)
    resetForm()
  }

  const handleCancel = () => {
    if (props.mode === "view" && isEditing()) {
      resetEditingState()
      return
    }

    props.onOpenChange(false)
  }

  createEffect(() => {
    const collection = props.collection
    if (collection) {
      setMountedCollection(collection)
    }
  })

  createEffect(() => {
    props.open
    props.mode
    currentCollection()?.id
    if (props.open) {
      setIsEditing(false)
      resetForm()
    }
  })

  createEffect(() => {
    if (!props.open) {
      setIsEditing(false)
      resetForm()
    }
  })

  const handleNameInput = (value: string) => {
    setName(value)
    if (!slugManuallyEdited()) {
      setSlug(collectionSlugFromName(value))
    }
  }

  const handleSlugInput = (value: string) => {
    setSlugManuallyEdited(true)
    setSlug(value)
  }

  const handleSave = async (event: Event) => {
    event.preventDefault()

    if (!canSave()) {
      return
    }

    const payload = {
      name: name().trim(),
      description: description().trim(),
      slug: slug().trim(),
    }

    setIsSaving(true)

    const result =
      props.mode === "create"
        ? await props.store.createCollection(payload)
        : await props.store.updateCollection(currentCollection()!.id, payload)

    setIsSaving(false)

    if (!result.success || !result.data) {
      notify.error({
        title: tr("notifications.saveError"),
        content: result.error ?? tr("notifications.saveError"),
      })
      return
    }

    if (props.mode === "create") {
      props.onOpenChange(false)
      notify.success({
        content: tr("notifications.createSuccess"),
      })
      return
    }

    setMountedCollection(result.data)
    setIsEditing(false)
    notify.success({
      content: tr("notifications.saveSuccess"),
    })
  }

  const handleDelete = () => {
    const collection = currentCollection()
    if (!collection || props.mode !== "view" || isSaving() || isDeleting()) {
      return
    }

    confirm({
      title: tr("confirmDelete.title"),
      prompt: tr("confirmDelete.prompt", { name: collection.name }),
      variant: "destructive",
      confirmationActionLabel: tr("confirmDelete.actions.confirm"),
      confirmationActionLoadingLabel: tr("confirmDelete.actions.confirming"),
      cancelActionLabel: tr("confirmDelete.actions.cancel"),
      onConfirm: async () => {
        setIsDeleting(true)
        const result = await props.store.deleteCollection(collection.id)
        setIsDeleting(false)

        if (!result.success) {
          notify.error({
            title: tr("notifications.deleteError"),
            content: result.error ?? tr("notifications.deleteError"),
          })
          return
        }

        props.onOpenChange(false)
        notify.success({
          content: tr("notifications.deleteSuccess"),
        })
      },
    })
  }

  return (
    <FormDrawer
      open={props.open}
      onOpenChange={open => props.onOpenChange(open)}
      title={drawerTitle()}
      closeAriaLabel={tr("actions.close")}
      class="collection-form-drawer"
      when={props.mode === "create" || Boolean(currentCollection())}
      canDismiss={() => !isSaving() && !isDeleting()}
      onClosed={() => setMountedCollection(null)}
      actionsClass="form-drawer-actions collection-form-drawer-actions"
      actions={
        <Show
          when={isFormMode()}
          fallback={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="collection-form-drawer-delete"
                label={
                  isDeleting()
                    ? tr("actions.deleting")
                    : tr("actions.delete")
                }
                disabled={isSaving() || isDeleting()}
                onClick={handleDelete}
              />
              <div class="collection-form-drawer-primary-actions">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  label={tr("actions.edit")}
                  disabled={isSaving() || isDeleting()}
                  onClick={() => {
                    resetForm()
                    setIsEditing(true)
                  }}
                />
              </div>
            </>
          }>
          <Show when={props.mode === "view"}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="collection-form-drawer-delete"
              label={
                isDeleting()
                  ? tr("actions.deleting")
                  : tr("actions.delete")
              }
              disabled={isSaving() || isDeleting()}
              onClick={handleDelete}
            />
          </Show>
          <div class="collection-form-drawer-primary-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              label={
                props.mode === "view" ? tr("actions.cancelEdit") : tr("actions.cancel")
              }
              disabled={isSaving() || isDeleting()}
              onClick={handleCancel}
            />
            <Button
              type="submit"
              form={COLLECTION_FORM_ID}
              variant="primary"
              size="sm"
              label={isSaving() ? tr("actions.saving") : tr("actions.save")}
              disabled={!canSave()}
            />
          </div>
        </Show>
      }>
      <Show
        when={isFormMode()}
        fallback={
          <Show when={currentCollection()}>
            {collection => (
              <div class="collection-form-drawer-view">
                <div class="collection-form-drawer-view-heading">
                  <div class="collection-form-drawer-view-name">{collection().name}</div>
                  <div class="collection-form-drawer-view-slug">{collection().slug}</div>
                </div>
                <div class="collection-form-drawer-details">
                  <p class="collection-form-drawer-detail-line">
                    <span class="collection-form-drawer-detail-label">
                      {tr("fields.description.label")}:
                    </span>{" "}
                    {collection().description?.trim() || tr("fields.noDescription")}
                  </p>
                  <p class="collection-form-drawer-detail-line">
                    {tr("fields.referenceCount", {
                      count: collection().referenceCount,
                    })}
                  </p>
                  <p class="collection-form-drawer-detail-line">
                    <span class="collection-form-drawer-detail-label">
                      {tr("fields.updatedAt")}:
                    </span>{" "}
                    {formatLongDate(collection().updatedAt) ?? tr("values.unavailable")}
                  </p>
                </div>
                <a
                  href={pages.scriptureCollection(collection().slug)}
                  class="collection-form-drawer-view-references-link">
                  {tr("actions.viewReferences")}
                </a>
              </div>
            )}
          </Show>
        }>
        <form
          id={COLLECTION_FORM_ID}
          class="collection-form-drawer-form"
          onSubmit={handleSave}>
          <Input
            label={tr("fields.name.label")}
            value={name()}
            maxlength={64}
            placeholder={tr("fields.name.placeholder")}
            onInput={event => handleNameInput(event.currentTarget.value)}
            disabled={isSaving() || isDeleting()}
          />
          <Input
            label={tr("fields.description.label")}
            value={description()}
            maxlength={256}
            placeholder={tr("fields.description.placeholder")}
            onInput={event => setDescription(event.currentTarget.value)}
            disabled={isSaving() || isDeleting()}
          />
          <Input
            label={tr("fields.slug.label")}
            value={slug()}
            maxlength={96}
            placeholder={tr("fields.slug.placeholder")}
            hint={tr("fields.slug.hint")}
            onInput={event => handleSlugInput(event.currentTarget.value)}
            disabled={isSaving() || isDeleting()}
          />
        </form>
      </Show>
    </FormDrawer>
  )
}
