import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { Button } from "@/components/button"
import { Combobox } from "@/components/combobox"
import { Icon } from "@/components/icon"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
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
import { withWindow } from "@/util/browser"
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

type ReferenceFormDrawerMode = "create" | "edit"

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
  const CLOSE_ANIMATION_MS = 500
  const notify = useNotify()
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
  const [isMounted, setIsMounted] = createSignal(false)
  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null)
  const [passagePreview, setPassagePreview] = createSignal<PassageState>({ status: "idle" })
  let closeUnmountTimeout: ReturnType<typeof setTimeout> | null = null

  const currentReference = createMemo(() => props.reference ?? mountedReference())
  const drawerTitle = createMemo(() =>
    props.mode === "create" ? tr("title.create") : tr("title.edit"),
  )
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
    if (props.mode !== "edit") {
      return true
    }

    const reference = currentReference()
    const preview = normalizedPreview()
    if (!reference || !preview) {
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
  })
  const drawerBehavior = createMemo(() => ({
    closeOnEscapeKeyDown: false,
    closeOnOutsidePointer: false,
    closeOnOutsideFocus: false,
    snapPoints: [1],
    breakPoints: [],
    defaultSnapPoint: 1,
  }))

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

  const requestClose = () => {
    if (isSaving()) {
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
      setMountedReference(null)
      closeUnmountTimeout = null
    }, CLOSE_ANIMATION_MS)
  })

  createEffect(() => {
    if (!props.open || isSaving()) {
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

  createEffect(() => {
    if (!props.open || isSaving()) {
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

    if (props.mode === "edit" && !currentReference()) {
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
    props.onOpenChange(false)
    notify.success({
      content:
        props.mode === "create"
          ? tr("notifications.createSuccess")
          : tr("notifications.updateSuccess"),
    })
  }

  return (
    <Show when={isMounted()}>
      <Drawer
        side={DrawerPosition.RIGHT}
        open={props.open}
        onOpenChange={open => props.onOpenChange(open)}
        contentRef={setContentElement}
        showTrigger={false}
        showClose={false}
        drawerProps={drawerBehavior()}
        class="reference-form-drawer"
        title={drawerTitle()}
        closeAriaLabel={tr("actions.close")}>
        <button
          type="button"
          class="reference-form-drawer-close"
          aria-label={tr("actions.close")}
          onClick={() => requestClose()}>
          <Icon name="chevron_right" />
        </button>
        <div class="reference-form-drawer-shell">
          <div class="reference-form-drawer-form">
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
              disabled={isSaving()}
            />

            <div class="reference-form-drawer-verse-fields">
              <Input
                label={tr("fields.chapter.label")}
                type="number"
                min={1}
                inputmode="numeric"
                value={chapter()}
                onInput={event => setChapter(event.currentTarget.value)}
                disabled={isSaving()}
              />
              <Input
                label={tr("fields.startVerse.label")}
                type="number"
                min={1}
                inputmode="numeric"
                value={startVerse()}
                onInput={event => setStartVerse(event.currentTarget.value)}
                disabled={isSaving()}
              />
              <Input
                label={tr("fields.endVerse.label")}
                type="number"
                min={1}
                inputmode="numeric"
                value={endVerse()}
                placeholder={tr("fields.endVerse.placeholder")}
                onInput={event => setEndVerse(event.currentTarget.value)}
                disabled={isSaving()}
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
              disabled={isSaving()}
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

            <div class="reference-form-drawer-actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                label={tr("actions.cancel")}
                disabled={isSaving()}
                onClick={() => requestClose()}
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
          </div>
        </div>
      </Drawer>
    </Show>
  )
}
