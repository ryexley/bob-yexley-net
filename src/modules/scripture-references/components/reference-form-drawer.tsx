import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { Button } from "@/components/button"
import { Combobox } from "@/components/combobox"
import { FormDrawer } from "@/components/form-drawer"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
import { useConfirm } from "@/components/confirm-dialog"
import {
  ScripturePassagePanel,
  type PassageState,
} from "@/modules/blips/components/scripture-passage-panel"
import { CANONICAL_BOOK_NAMES } from "@/lib/bible/book-map"
import type { scriptureCollectionStore } from "@/modules/scripture-collections/data/store"
import type { AdminCollectionRecord } from "@/modules/scripture-collections/data/types"
import {
  ReferenceCollections,
  type ReferenceCollectionOption,
} from "@/modules/scripture-references/components/reference-collections"
import type { scriptureReferenceStore } from "@/modules/scripture-references/data/store"
import type { AdminReferenceRecord } from "@/modules/scripture-references/data/types"
import { buildNormalizedReferencePreview } from "@/modules/scripture-references/util/reference-preview"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { formatLongDate } from "@/util/formatters"
import "./reference-form-drawer.css"

const tr = ptr("scriptureReferences.components.referenceFormDrawer")
const PASSAGE_PREVIEW_DEBOUNCE_MS = 350

type BookOption = {
  value: string
  label: string
}

type ReferenceStore = ReturnType<typeof scriptureReferenceStore>
type CollectionStore = ReturnType<typeof scriptureCollectionStore>

const bookOptions: BookOption[] = CANONICAL_BOOK_NAMES.map(name => ({
  value: name,
  label: name,
}))

type ReferenceFormDrawerMode = "create" | "view"

type ReferenceFormDrawerProps = {
  open: boolean
  mode: ReferenceFormDrawerMode
  reference?: AdminReferenceRecord | null
  collections: AdminCollectionRecord[]
  defaultCollectionNames?: string[]
  referenceStore: ReferenceStore
  collectionStore: CollectionStore
  onOpenChange: (open: boolean) => void
}

const canonicalizeCollectionNames = (values: string[]) => {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const value of values.map(item => item.trim()).filter(Boolean)) {
    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(value)
  }

  return unique.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  )
}

const toCollectionOptions = (values: string[]): ReferenceCollectionOption[] =>
  canonicalizeCollectionNames(values).map(value => ({
    value,
    label: value,
  }))

const areCollectionNamesEqual = (left: string[], right: string[]) => {
  const normalizedLeft = canonicalizeCollectionNames(left)
  const normalizedRight = canonicalizeCollectionNames(right)

  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

async function fetchPassagePreview(reference: string, book: string, query: {
  chapter: number
  startVerse: number
  endVerse: number | null
}): Promise<PassageState> {
  const params = new URLSearchParams({
    book,
    chapter: String(query.chapter),
    start_verse: String(query.startVerse),
    cache: "false",
    ...(query.endVerse != null ? { end_verse: String(query.endVerse) } : {}),
  })

  try {
    const response = await fetch(`/api/bible/passage?${params}`)
    if (!response.ok) {
      throw new Error("Passage request failed")
    }

    const data = (await response.json()) as { passage?: string; reference?: string }
    if (!data.passage || data.reference !== reference) {
      throw new Error("Passage missing from response")
    }

    return {
      status: "loaded",
      text: data.passage,
    }
  } catch {
    return { status: "error" }
  }
}

export function ReferenceFormDrawer(props: ReferenceFormDrawerProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isEditing, setIsEditing] = createSignal(false)
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [mountedReference, setMountedReference] = createSignal<AdminReferenceRecord | null>(
    props.reference ?? null,
  )
  const [selectedBook, setSelectedBook] = createSignal<BookOption | null>(null)
  const [chapter, setChapter] = createSignal("")
  const [startVerse, setStartVerse] = createSignal("")
  const [endVerse, setEndVerse] = createSignal("")
  const [selectedCollections, setSelectedCollections] = createSignal<
    ReferenceCollectionOption[]
  >([])
  const [collectionOptions, setCollectionOptions] = createSignal<
    ReferenceCollectionOption[]
  >([])
  const [isSaving, setIsSaving] = createSignal(false)
  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null)
  const [passagePreview, setPassagePreview] = createSignal<PassageState>({ status: "idle" })

  const currentReference = createMemo(() => props.reference ?? mountedReference())
  const isFormMode = createMemo(() => props.mode === "create" || isEditing())
  const drawerTitle = createMemo(() => {
    if (props.mode === "create") {
      return tr("title.create")
    }

    const reference = currentReference()
    if (isEditing()) {
      return tr("title.edit")
    }

    return reference?.normalized ?? tr("title.view")
  })
  const saveLabel = createMemo(() =>
    isSaving()
      ? tr("actions.saving")
      : props.mode === "create"
        ? tr("actions.saveCreate")
        : tr("actions.saveEdit"),
  )
  const selectedCollectionNames = () =>
    canonicalizeCollectionNames(selectedCollections().map(collection => collection.value))

  const normalizedPreview = createMemo(() =>
    buildNormalizedReferencePreview(
      selectedBook()?.value ?? "",
      chapter(),
      startVerse(),
      endVerse(),
    ),
  )
  const isDirty = createMemo(() => {
    if (props.mode === "create") {
      return true
    }

    const reference = currentReference()
    const preview = normalizedPreview()
    if (!reference || !preview || !isEditing()) {
      return false
    }

    const endVerseTrimmed = endVerse().trim()
    const endVerseValue =
      endVerseTrimmed.length > 0 ? Number.parseInt(endVerseTrimmed, 10) : null

    return (
      (selectedBook()?.value ?? "") !== reference.book ||
      Number.parseInt(chapter(), 10) !== reference.chapter ||
      Number.parseInt(startVerse(), 10) !== reference.startVerse ||
      endVerseValue !== reference.endVerse ||
      !areCollectionNamesEqual(
        selectedCollectionNames(),
        reference.collections.map(collection => collection.name),
      )
    )
  })
  const canSave = createMemo(
    () =>
      normalizedPreview() !== null &&
      passagePreview().status === "loaded" &&
      !isSaving() &&
      !isDeleting() &&
      (props.mode === "create" || isDirty()),
  )
  const portalMount = createMemo(() => contentElement() ?? undefined)
  const mergeCollectionOptions = (values: string[]) => {
    const normalizedValues = canonicalizeCollectionNames(values)
    if (normalizedValues.length === 0) {
      return
    }

    setCollectionOptions(previous => {
      const byValue = new Map(
        previous.map(option => [option.value.trim().toLowerCase(), option]),
      )

      for (const value of normalizedValues) {
        byValue.set(value.toLowerCase(), { value, label: value })
      }

      return [...byValue.values()].sort((left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: "base" }),
      )
    })
  }
  const passageFetchRequest = createMemo(() => {
    if (isFormMode()) {
      const book = selectedBook()?.value
      const reference = normalizedPreview()
      if (!book || !reference) {
        return null
      }

      const chapterValue = Number.parseInt(chapter(), 10)
      const startVerseValue = Number.parseInt(startVerse(), 10)
      const endVerseTrimmed = endVerse().trim()
      const endVerseValue =
        endVerseTrimmed.length > 0 ? Number.parseInt(endVerseTrimmed, 10) : null

      return {
        book,
        reference,
        chapter: chapterValue,
        startVerse: startVerseValue,
        endVerse: endVerseValue,
      }
    }

    const reference = currentReference()
    if (!reference) {
      return null
    }

    return {
      book: reference.book,
      reference: reference.normalized,
      chapter: reference.chapter,
      startVerse: reference.startVerse,
      endVerse: reference.endVerse,
    }
  })

  const resetForm = () => {
    mergeCollectionOptions(props.collections.map(collection => collection.name))

    if (props.mode === "create") {
      setSelectedBook(null)
      setChapter("")
      setStartVerse("")
      setEndVerse("")
      setPassagePreview({ status: "idle" })
      setSelectedCollections(toCollectionOptions(props.defaultCollectionNames ?? []))
      return
    }

    const reference = currentReference()
    if (!reference) {
      return
    }

    setSelectedBook({
      value: reference.book,
      label: reference.book,
    })
    setChapter(String(reference.chapter))
    setStartVerse(String(reference.startVerse))
    setEndVerse(reference.endVerse != null ? String(reference.endVerse) : "")
    setPassagePreview({ status: "idle" })
    const collectionNames = reference.collections.map(collection => collection.name)
    mergeCollectionOptions(collectionNames)
    setSelectedCollections(toCollectionOptions(collectionNames))
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
    const reference = props.reference
    if (reference) {
      setMountedReference(reference)
    }
  })

  createEffect(() => {
    props.collections.map(collection => collection.name)
    mergeCollectionOptions(props.collections.map(collection => collection.name))
  })

  createEffect(() => {
    props.open
    props.mode
    props.defaultCollectionNames
    currentReference()?.id
    if (props.open) {
      setIsEditing(false)
      resetForm()
    }
  })

  createEffect(() => {
    if (!props.open || isSaving() || isDeleting()) {
      return
    }

    const request = passageFetchRequest()
    if (!request) {
      setPassagePreview({ status: "idle" })
      return
    }

    setPassagePreview({ status: "loading" })
    let cancelled = false
    const timeoutId = setTimeout(() => {
      void fetchPassagePreview(request.reference, request.book, {
        chapter: request.chapter,
        startVerse: request.startVerse,
        endVerse: request.endVerse,
      }).then(result => {
        if (!cancelled) {
          setPassagePreview(result)
        }
      })
    }, PASSAGE_PREVIEW_DEBOUNCE_MS)

    onCleanup(() => {
      cancelled = true
      clearTimeout(timeoutId)
    })
  })

  const handleCollectionSelectionChange = (nextCollections: ReferenceCollectionOption[]) => {
    setSelectedCollections(nextCollections)
    mergeCollectionOptions(nextCollections.map(collection => collection.value))
  }

  const handleSave = async () => {
    const preview = normalizedPreview()
    const book = selectedBook()?.value
    const chapterValue = Number.parseInt(chapter(), 10)
    const startVerseValue = Number.parseInt(startVerse(), 10)
    const endVerseTrimmed = endVerse().trim()
    const endVerseValue =
      endVerseTrimmed.length > 0 ? Number.parseInt(endVerseTrimmed, 10) : null

    if (!preview || !book || !canSave()) {
      return
    }

    if (props.mode === "view" && !currentReference()) {
      return
    }

    setIsSaving(true)

    const payload = {
      book,
      chapter: chapterValue,
      startVerse: startVerseValue,
      endVerse: endVerseValue,
      collectionNames: selectedCollectionNames(),
    }

    const upsertCollections = props.collectionStore.upsertCollectionsByName.bind(
      props.collectionStore,
    )

    const result =
      props.mode === "create"
        ? await props.referenceStore.createReference(payload, upsertCollections)
        : await props.referenceStore.updateReference(
            currentReference()!.id,
            payload,
            upsertCollections,
          )
    setIsSaving(false)

    if (!result.success || !result.data) {
      notify.error({
        title:
          props.mode === "create"
            ? tr("notifications.createError")
            : tr("notifications.updateError"),
        content:
          result.error ??
          (props.mode === "create"
            ? tr("notifications.createError")
            : tr("notifications.updateError")),
      })
      return
    }

    mergeCollectionOptions(result.data.collections.map(collection => collection.name))

    if (props.mode === "create") {
      props.onOpenChange(false)
      notify.success({
        content: tr("notifications.createSuccess"),
      })
      return
    }

    setMountedReference(result.data)
    setIsEditing(false)
    notify.success({
      content: tr("notifications.updateSuccess"),
    })
  }

  const handleDelete = () => {
    const reference = currentReference()
    if (!reference || props.mode !== "view" || isSaving() || isDeleting()) {
      return
    }

    confirm({
      title: tr("confirmDelete.title"),
      prompt: tr("confirmDelete.prompt", { reference: reference.normalized }),
      variant: "destructive",
      confirmationActionLabel: tr("confirmDelete.actions.confirm"),
      confirmationActionLoadingLabel: tr("confirmDelete.actions.confirming"),
      cancelActionLabel: tr("confirmDelete.actions.cancel"),
      onConfirm: async () => {
        setIsDeleting(true)
        const result = await props.referenceStore.deleteReference(reference.id)
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

  const renderPassagePreview = () => (
    <Show when={passageFetchRequest()}>
      <div class="reference-form-drawer-passage-preview">
        <span class="reference-form-drawer-preview-label">
          {tr("fields.passagePreview.label")}
        </span>
        <Show
          when={passagePreview().status === "error"}
          fallback={
            <ScripturePassagePanel
              reference={passageFetchRequest()!.reference}
              state={passagePreview()}
              showReference={false}
            />
          }>
          <p class="reference-form-drawer-passage-preview-error">
            {tr("fields.passagePreview.error")}
          </p>
        </Show>
      </div>
    </Show>
  )

  return (
    <FormDrawer
      open={props.open}
      onOpenChange={open => props.onOpenChange(open)}
      title={drawerTitle()}
      closeAriaLabel={tr("actions.close")}
      class="reference-form-drawer"
      when={props.mode === "create" || Boolean(currentReference())}
      canDismiss={() => !isSaving() && !isDeleting()}
      onContentRef={setContentElement}
      onClosed={() => setMountedReference(null)}
      actionsClass="form-drawer-actions reference-form-drawer-actions"
      actions={
        <Show
          when={isFormMode()}
          fallback={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="reference-form-drawer-delete"
                label={
                  isDeleting()
                    ? tr("actions.deleting")
                    : tr("actions.delete")
                }
                disabled={isSaving() || isDeleting()}
                onClick={handleDelete}
              />
              <div class="reference-form-drawer-primary-actions">
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
              class="reference-form-drawer-delete"
              label={
                isDeleting()
                  ? tr("actions.deleting")
                  : tr("actions.delete")
              }
              disabled={isSaving() || isDeleting()}
              onClick={handleDelete}
            />
          </Show>
          <div class="reference-form-drawer-primary-actions">
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
              type="button"
              variant="primary"
              size="sm"
              label={saveLabel()}
              disabled={!canSave()}
              onClick={() => void handleSave()}
            />
          </div>
        </Show>
      }>
      <Show
        when={isFormMode()}
        fallback={
          <Show when={currentReference()}>
            {reference => (
              <div class="reference-form-drawer-view">
                <div class="reference-form-drawer-details">
                  <p class="reference-form-drawer-detail-line">
                    <span class="reference-form-drawer-detail-label">
                      {tr("fields.slug.label")}:
                    </span>{" "}
                    {reference().slug}
                  </p>
                  <p class="reference-form-drawer-detail-line">
                    <span class="reference-form-drawer-detail-label">
                      {tr("fields.book.label")}:
                    </span>{" "}
                    {reference().book}
                  </p>
                  <p class="reference-form-drawer-detail-line">
                    <span class="reference-form-drawer-detail-label">
                      {tr("fields.chapter.label")}:
                    </span>{" "}
                    {reference().chapter}
                  </p>
                  <p class="reference-form-drawer-detail-line">
                    <span class="reference-form-drawer-detail-label">
                      {tr("fields.startVerse.label")}:
                    </span>{" "}
                    {reference().startVerse}
                    <Show when={reference().endVerse != null}>
                      {" "}
                      – {reference().endVerse}
                    </Show>
                  </p>
                  <p class="reference-form-drawer-detail-line">
                    <span class="reference-form-drawer-detail-label">
                      {tr("fields.collection.label")}:
                    </span>{" "}
                    <Show
                      when={reference().collections.length > 0}
                      fallback={tr("fields.uncollected")}>
                      <span class="reference-form-drawer-view-collections">
                        <For each={reference().collections}>
                          {collection => (
                            <a
                              href={
                                collection.slug
                                  ? pages.scriptureCollection(collection.slug)
                                  : pages.scriptureCollectionById(collection.id)
                              }
                              class="reference-form-drawer-view-collection-link">
                              {collection.name}
                            </a>
                          )}
                        </For>
                      </span>
                    </Show>
                  </p>
                  <p class="reference-form-drawer-detail-line">
                    <span class="reference-form-drawer-detail-label">
                      {tr("fields.updatedAt")}:
                    </span>{" "}
                    {formatLongDate(reference().updatedAt) ?? tr("values.unavailable")}
                  </p>
                </div>
                {renderPassagePreview()}
              </div>
            )}
          </Show>
        }>
        <Combobox<BookOption>
          label={tr("fields.book.label")}
          placeholder={tr("fields.book.placeholder")}
          options={bookOptions}
          value={selectedBook()}
          onChange={setSelectedBook}
          optionValue="value"
          optionTextValue="label"
          optionLabel="label"
          openOnFocus
          portalMount={portalMount()}
          disabled={isSaving() || isDeleting()}
        />

        <div class="reference-form-drawer-verse-fields">
          <Input
            label={tr("fields.chapter.label")}
            type="number"
            min={1}
            inputmode="numeric"
            value={chapter()}
            onInput={event => setChapter(event.currentTarget.value)}
            disabled={isSaving() || isDeleting()}
          />
          <Input
            label={tr("fields.startVerse.label")}
            type="number"
            min={1}
            inputmode="numeric"
            value={startVerse()}
            onInput={event => setStartVerse(event.currentTarget.value)}
            disabled={isSaving() || isDeleting()}
          />
          <Input
            label={tr("fields.endVerse.label")}
            type="number"
            min={1}
            inputmode="numeric"
            value={endVerse()}
            placeholder={tr("fields.endVerse.placeholder")}
            onInput={event => setEndVerse(event.currentTarget.value)}
            disabled={isSaving() || isDeleting()}
          />
        </div>

        <ReferenceCollections
          label={tr("fields.collection.label")}
          placeholder={tr("fields.collection.placeholder")}
          containerClass="reference-form-drawer-collection-combobox"
          options={collectionOptions()}
          value={selectedCollections()}
          onChange={handleCollectionSelectionChange}
          freeSolo
          portalMount={portalMount()}
          disabled={isSaving() || isDeleting()}
          onCreateOption={inputValue => {
            const value = inputValue.trim()
            if (!value) {
              return null
            }

            const existing = collectionOptions().find(
              option => option.label.trim().toLowerCase() === value.toLowerCase(),
            )

            return existing ?? { value, label: value }
          }}
        />

        <div class="reference-form-drawer-preview">
          <span class="reference-form-drawer-preview-label">
            {tr("fields.preview.label")}
          </span>
          <span class="reference-form-drawer-preview-value">
            {normalizedPreview() ?? tr("fields.preview.placeholder")}
          </span>
        </div>

        {renderPassagePreview()}
      </Show>
    </FormDrawer>
  )
}
