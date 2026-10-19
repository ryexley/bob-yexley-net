import { createEffect, createMemo, createSignal, For, untrack } from "solid-js"
import { Button } from "@/components/button"
import { FormDrawer } from "@/components/form-drawer"
import { IconButton } from "@/components/icon-button"
import { UnsplashImage } from "@/components/image"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
import { updateHomeHeroImageIdsRecord } from "@/modules/site-settings/data/client"
import {
  MAX_HOME_HERO_IMAGES,
  parseHeroImageIdInput,
  sameHeroImageIds,
} from "@/modules/site-settings/home-hero-images"
import { ptr } from "@/i18n"
import "./home-hero-images-drawer.css"

const tr = ptr("siteSettings.components.homeHeroImagesDrawer")
const FORM_ID = "home-hero-images-drawer-form"

type HomeHeroImagesDrawerProps = {
  open: boolean
  imageIds: string[]
  onOpenChange: (open: boolean) => void
  onSaved: (imageIds: string[]) => void
}

export function HomeHeroImagesDrawer(props: HomeHeroImagesDrawerProps) {
  const notify = useNotify()
  const [imageIds, setImageIds] = createSignal<string[]>(
    untrack(() => props.imageIds),
  )
  const [nextId, setNextId] = createSignal("")
  const [addError, setAddError] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)

  const isDirty = createMemo(
    () => !sameHeroImageIds(imageIds(), props.imageIds),
  )
  const canAddMore = createMemo(() => imageIds().length < MAX_HOME_HERO_IMAGES)

  const resetForm = () => {
    setImageIds([...props.imageIds])
    setNextId("")
    setAddError("")
  }

  createEffect(() => {
    if (!props.open) {
      return
    }

    untrack(() => resetForm())
  })

  const moveImage = (index: number, delta: number) => {
    const next = [...imageIds()]
    const target = index + delta
    if (target < 0 || target >= next.length) {
      return
    }

    const [item] = next.splice(index, 1)
    if (!item) {
      return
    }

    next.splice(target, 0, item)
    setImageIds(next)
  }

  const removeImage = (index: number) => {
    if (imageIds().length <= 1) {
      return
    }

    setImageIds(imageIds().filter((_, currentIndex) => currentIndex !== index))
  }

  const addImage = () => {
    if (!canAddMore()) {
      setAddError(tr("errors.max", { count: MAX_HOME_HERO_IMAGES }))
      return
    }

    const id = parseHeroImageIdInput(nextId())
    if (!id) {
      setAddError(tr("errors.invalid"))
      return
    }

    if (imageIds().includes(id)) {
      setAddError(tr("errors.duplicate"))
      return
    }

    setImageIds([...imageIds(), id])
    setNextId("")
    setAddError("")
  }

  const handleSave = async (event: Event) => {
    event.preventDefault()

    if (isSaving() || !isDirty()) {
      return
    }

    setIsSaving(true)
    const result = await updateHomeHeroImageIdsRecord(imageIds())
    setIsSaving(false)

    if (!result.success || !result.data) {
      notify.error({
        title: tr("notifications.saveError"),
        content: result.error ?? tr("notifications.saveError"),
      })
      return
    }

    props.onSaved(result.data)
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
      class="home-hero-images-drawer"
      canDismiss={() => !isSaving()}
      actions={
        <>
          <Button
            type="submit"
            form={FORM_ID}
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
      <form
        id={FORM_ID}
        class="form"
        onSubmit={event => void handleSave(event)}>
        <p class="hint">{tr("hint")}</p>

        <ol class="list">
          <For each={imageIds()}>
            {(imageId, index) => (
              <li class="row">
                <div class="preview">
                  <UnsplashImage
                    imageId={imageId}
                    alt=""
                    width="100%"
                    showAttribution={false}
                    trackDownload={false}
                  />
                </div>
                <div class="meta">
                  <code class="id">{imageId}</code>
                  <div class="row-actions">
                    <IconButton
                      icon="chevronUp"
                      size="xs"
                      aria-label={tr("actions.moveUp")}
                      disabled={isSaving() || index() === 0}
                      onClick={() => moveImage(index(), -1)}
                    />
                    <IconButton
                      icon="chevronDown"
                      size="xs"
                      aria-label={tr("actions.moveDown")}
                      disabled={isSaving() || index() === imageIds().length - 1}
                      onClick={() => moveImage(index(), 1)}
                    />
                    <IconButton
                      icon="trash"
                      size="xs"
                      aria-label={tr("actions.remove")}
                      disabled={isSaving() || imageIds().length <= 1}
                      onClick={() => removeImage(index())}
                    />
                  </div>
                </div>
              </li>
            )}
          </For>
        </ol>

        <div class="add">
          <Input
            label={tr("fields.add.label")}
            type="text"
            value={nextId()}
            placeholder={tr("fields.add.placeholder")}
            hint={tr("fields.add.hint")}
            disabled={isSaving() || !canAddMore()}
            onInput={event => {
              setNextId(event.currentTarget.value)
              if (addError()) {
                setAddError("")
              }
            }}
          />
          {addError() ? <p class="add-error">{addError()}</p> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            label={tr("actions.add")}
            disabled={
              isSaving() || !canAddMore() || nextId().trim().length === 0
            }
            onClick={addImage}
          />
        </div>
      </form>
    </FormDrawer>
  )
}
