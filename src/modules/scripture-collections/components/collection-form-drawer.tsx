import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { Button } from "@/components/button"
import { Icon } from "@/components/icon"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
import { useConfirm } from "@/components/confirm-dialog"
import type { scriptureCollectionStore } from "@/modules/scripture-collections/data/store"
import { collectionSlugFromName } from "@/modules/scripture-collections/util/collection-slug"
import type { AdminCollectionRecord } from "@/modules/scripture-collections/data/types"
import { ptr } from "@/i18n"
import { withWindow } from "@/util/browser"
import "./collection-form-drawer.css"

const tr = ptr("scriptureCollections.components.collectionFormDrawer")

type CollectionFormDrawerMode = "create" | "edit"

type CollectionStore = ReturnType<typeof scriptureCollectionStore>

type CollectionFormDrawerProps = {
  open: boolean
  mode: CollectionFormDrawerMode
  collection: AdminCollectionRecord | null
  store: CollectionStore
  onOpenChange: (open: boolean) => void
}

export function CollectionFormDrawer(props: CollectionFormDrawerProps) {
  const CLOSE_ANIMATION_MS = 500
  const notify = useNotify()
  const confirm = useConfirm()
  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [slug, setSlug] = createSignal("")
  const [slugManuallyEdited, setSlugManuallyEdited] = createSignal(false)
  const [isSaving, setIsSaving] = createSignal(false)
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [isMounted, setIsMounted] = createSignal(false)
  const [mountedCollection, setMountedCollection] =
    createSignal<AdminCollectionRecord | null>(props.collection)
  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null)
  let closeUnmountTimeout: ReturnType<typeof setTimeout> | null = null

  const currentCollection = createMemo(() => props.collection ?? mountedCollection())
  const drawerTitle = createMemo(() =>
    props.mode === "create" ? tr("title.create") : tr("title.edit"),
  )
  const drawerBehavior = createMemo(() => ({
    closeOnEscapeKeyDown: false,
    closeOnOutsidePointer: false,
    closeOnOutsideFocus: false,
    snapPoints: [1],
    breakPoints: [],
    defaultSnapPoint: 1,
  }))
  const isDirty = createMemo(() => {
    if (props.mode === "create") {
      return (
        name().trim().length > 0 ||
        description().trim().length > 0 ||
        slug().trim().length > 0
      )
    }

    const collection = currentCollection()
    if (!collection) {
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

  const requestClose = () => {
    if (isSaving() || isDeleting()) {
      return
    }

    props.onOpenChange(false)
  }

  const clearCloseUnmountTimeout = () => {
    if (closeUnmountTimeout) {
      clearTimeout(closeUnmountTimeout)
      closeUnmountTimeout = null
    }
  }

  createEffect(() => {
    const collection = props.collection
    if (collection) {
      setMountedCollection(collection)
    }
  })

  createEffect(() => {
    props.mode
    currentCollection()?.id
    if (props.open) {
      resetForm()
    }
  })

  createEffect(() => {
    if (!props.open) {
      resetForm()
    }
  })

  createEffect(() => {
    if (props.open) {
      clearCloseUnmountTimeout()
      setIsMounted(true)
      return
    }

    if (!isMounted()) {
      return
    }

    clearCloseUnmountTimeout()
    closeUnmountTimeout = setTimeout(() => {
      setIsMounted(false)
      setMountedCollection(null)
      closeUnmountTimeout = null
    }, CLOSE_ANIMATION_MS)
  })

  createEffect(() => {
    if (!props.open || isSaving() || isDeleting()) {
      return
    }

    const content = contentElement()
    if (!content) {
      return
    }

    withWindow(window => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return
        }

        event.preventDefault()
        requestClose()
      }

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target
        if (!(target instanceof Node) || content.contains(target)) {
          return
        }

        requestClose()
      }

      window.document.addEventListener("keydown", handleKeyDown)
      window.document.addEventListener("pointerdown", handlePointerDown, true)

      onCleanup(() => {
        window.document.removeEventListener("keydown", handleKeyDown)
        window.document.removeEventListener("pointerdown", handlePointerDown, true)
      })
    })
  })

  onCleanup(() => {
    clearCloseUnmountTimeout()
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

    props.onOpenChange(false)
    notify.success({
      content:
        props.mode === "create"
          ? tr("notifications.createSuccess")
          : tr("notifications.saveSuccess"),
    })
  }

  const handleDelete = () => {
    const collection = currentCollection()
    if (!collection || props.mode !== "edit" || isSaving() || isDeleting()) {
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
    <Show when={isMounted() && (props.mode === "create" || currentCollection())}>
      <Drawer
        side={DrawerPosition.RIGHT}
        open={props.open}
        onOpenChange={open => props.onOpenChange(open)}
        contentRef={setContentElement}
        showTrigger={false}
        showClose={false}
        drawerProps={drawerBehavior()}
        class="collection-form-drawer"
        title={drawerTitle()}
        closeAriaLabel={tr("actions.close")}>
        <button
          type="button"
          class="collection-form-drawer-close"
          aria-label={tr("actions.close")}
          onClick={() => requestClose()}>
          <Icon name="chevron_right" />
        </button>
        <div class="collection-form-drawer-shell">
          <form
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

            <div class="collection-form-drawer-actions">
              <Show when={props.mode === "edit"}>
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
                  label={tr("actions.cancel")}
                  disabled={isSaving() || isDeleting()}
                  onClick={() => requestClose()}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  label={isSaving() ? tr("actions.saving") : tr("actions.save")}
                  disabled={!canSave()}
                />
              </div>
            </div>
          </form>
        </div>
      </Drawer>
    </Show>
  )
}
