import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  splitProps,
  Show,
} from "solid-js"
import { Drawer } from "@/components/drawer"
import { Stack } from "@/components/stack"
import { MarkdownEditor } from "@/components/markdown/editor"
import { IconButton } from "@/components/icon-button"
import { Blip as BlipIcon, Icon, LoadingSpinner } from "@/components/icon"
import { useConfirm } from "@/components/confirm-dialog"
import {
  BlipTags,
  type BlipTagOption,
} from "@/modules/blips/components/blip-tags"
import { withWindow } from "@/util/browser"
import { clsx as cx } from "@/util"
import { ptr } from "@/i18n"
import { debounce } from "@/util/debounce"
import { TIME } from "@/util/enums"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"
import { blipId, blipStore, tagStore } from "@/modules/blips/data"
import { slugify } from "@/util/formatters"
// Blip editor drawer styles are imported by `@/layouts/main/main.css` so they
// remain available for portaled editor UI in the shared main-layout chrome.

type BlipEditorProps = {
  open: boolean
  onPanelOpenChange: (open: boolean) => void
  close: () => void
  blipId?: string | null
}

type SaveStatus =
  | "idle"
  | "saving-cache"
  | "saving-db"
  | "saved-cache"
  | "saved-db"
  | "error"

type EditorView = "picker" | "editor"

const tr = ptr("blips.components.blipEditor")

export function BlipEditor(props: BlipEditorProps) {
  const [local] = splitProps(props, [
    "open",
    "onPanelOpenChange",
    "close",
    "blipId",
  ])
  const supabase = useSupabase()
  const { user } = useAuth() as any
  const confirm = useConfirm()

  const store = blipStore(supabase.client)
  const tags = tagStore(supabase.client)

  // Local state
  const [currentBlipId, setCurrentBlipId] = createSignal<string | null>(null)
  const [content, setContent] = createSignal<string>("")
  const [lastCachedContent, setLastCachedContent] = createSignal<string>("")
  const [lastDbSavedContent, setLastDbSavedContent] = createSignal<string>("")
  const [hasPersistedCurrentBlip, setHasPersistedCurrentBlip] =
    createSignal<boolean>(false)
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>("idle")
  const [showStatus, setShowStatus] = createSignal<boolean>(false)
  const [statusFading, setStatusFading] = createSignal<boolean>(false)
  const [editorView, setEditorView] = createSignal<EditorView>("editor")
  const [skipClosePersist, setSkipClosePersist] = createSignal<boolean>(false)
  const [selectedTags, setSelectedTags] = createSignal<BlipTagOption[]>([])
  const [tagOptions, setTagOptions] = createSignal<BlipTagOption[]>([])
  const [lastDbSavedTagValues, setLastDbSavedTagValues] = createSignal<string[]>(
    [],
  )
  const [comboboxPortalMount, setComboboxPortalMount] = createSignal<
    HTMLElement | undefined
  >()

  const drafts = createMemo(() => store.drafts())

  const isPublished = createMemo(() => {
    const id = currentBlipId()

    if (!id) {
      return false
    }

    const blip = store.entities().find(b => b.id === id)
    return blip?.published ?? false
  })

  let windowScrollYOnOpen: number = 0
  let hideStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let fadeStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let editorFocusTimeout: ReturnType<typeof setTimeout> | null = null
  let resetStateTimeout: ReturnType<typeof setTimeout> | null = null
  let hasOpenedAtLeastOnce = false

  const clearEditorFocusTimeout = () => {
    if (editorFocusTimeout) {
      clearTimeout(editorFocusTimeout)
      editorFocusTimeout = null
    }
  }

  const focusEditorInput = (attempt = 0) => {
    withWindow(() => {
      const editorInput = document.querySelector(
        ".blip-editor-container .ProseMirror[contenteditable=\"true\"]",
      ) as HTMLElement | null

      if (editorInput) {
        editorInput.focus()
        return
      }

      if (attempt < 10) {
        editorFocusTimeout = setTimeout(() => {
          focusEditorInput(attempt + 1)
        }, 50)
      }
    })
  }

  const startNewBlip = () => {
    const newBlipId = blipId()
    setCurrentBlipId(newBlipId)
    setContent("")
    setLastCachedContent("")
    setLastDbSavedContent("")
    setHasPersistedCurrentBlip(false)
    setSelectedTags([])
    setLastDbSavedTagValues([])
    setSaveStatus("idle")
    setEditorView("editor")
  }

  const openExistingBlip = (selectedBlip: Blip, assumePersisted = false) => {
    const selectedContent = selectedBlip.content || ""
    setCurrentBlipId(selectedBlip.id)
    setContent(selectedContent)
    setLastCachedContent(selectedContent)
    setLastDbSavedContent(assumePersisted ? selectedContent : "")
    setHasPersistedCurrentBlip(assumePersisted)
    setSelectedTags([])
    setLastDbSavedTagValues([])
    setSaveStatus("idle")
    setEditorView("editor")
    void syncPersistedBlipState(selectedBlip.id, assumePersisted)
    void hydrateTagsForBlip(selectedBlip.id)
  }

  const getDraftLabel = (draft: Blip) => {
    const title = draft.title?.trim()
    if (title) {
      return title
    }

    const normalized = (draft.content || "").replace(/\s+/g, " ").trim()
    if (!normalized) {
      return tr("draftPicker.untitled")
    }

    return normalized
  }

  const canonicalizeTagValues = (values: string[]) =>
    [...new Set(values.map(value => slugify(value).trim()).filter(Boolean))].sort()

  const selectedTagValues = () =>
    canonicalizeTagValues(selectedTags().map(tag => tag.value))

  const toTagOptions = (values: string[]): BlipTagOption[] =>
    values.map(value => ({ value, label: value }))

  const mergeTagOptions = (values: string[]) => {
    const normalizedValues = canonicalizeTagValues(values)
    if (normalizedValues.length === 0) {
      return
    }

    setTagOptions(previous => {
      const byValue = new Map(
        previous.map(option => [slugify(option.value).trim(), option]),
      )

      for (const value of normalizedValues) {
        byValue.set(value, { value, label: value })
      }

      return [...byValue.values()].sort((left, right) =>
        left.value.localeCompare(right.value),
      )
    })
  }

  const areTagValuesEqual = (left: string[], right: string[]) => {
    if (left.length !== right.length) {
      return false
    }

    return left.every((value, index) => value === right[index])
  }

  const loadTagOptions = async () => {
    const result = await tags.listTags()
    if (result.error) {
      console.error("Error loading tag options:", result.error)
      return
    }

    setTagOptions(toTagOptions(result.data?.map(tag => tag.name) ?? []))
  }

  const syncPersistedBlipState = async (
    blipId: string,
    assumePersisted: boolean,
  ) => {
    if (assumePersisted) {
      setHasPersistedCurrentBlip(true)
      return
    }

    const { data, error } = await supabase.client
      .from("blips")
      .select("id")
      .eq("id", blipId)
      .maybeSingle()

    if (error) {
      console.error("Error checking blip persistence state:", error.message)
      return
    }

    if (currentBlipId() !== blipId) {
      return
    }

    setHasPersistedCurrentBlip(Boolean(data))
  }

  const hydrateTagsForBlip = async (blipId: string) => {
    const result = await tags.getBlipTagValues(blipId)
    if (result.error) {
      console.error("Error loading blip tags:", result.error)
      return
    }

    if (currentBlipId() !== blipId) {
      return
    }

    const values = result.data ?? []
    setSelectedTags(toTagOptions(values))
    setLastDbSavedTagValues(values)
    mergeTagOptions(values)
  }

  const persistTagsToDatabase = async (
    blipId = currentBlipId(),
    values = selectedTagValues(),
  ) => {
    if (!blipId || !user()?.id || !hasPersistedCurrentBlip()) {
      return
    }

    const result = await tags.replaceBlipTags(blipId, values)
    if (result.error) {
      console.error("Error persisting blip tags:", result.error)
      return
    }

    const persistedValues = result.data ?? []
    setLastDbSavedTagValues(persistedValues)
    mergeTagOptions(persistedValues)

    const existingBlip = store.entities().find(blip => blip.id === blipId)
    await store.upsert(
      {
        id: blipId,
        tags: persistedValues,
        ...(existingBlip?.user_id ? { user_id: existingBlip.user_id } : {}),
      } as Partial<Blip>,
      { cacheOnly: true },
    )
  }

  // Save to cache only (localStorage + signal)
  const saveToCacheOnly = async (markdown: string) => {
    const blipId = currentBlipId()
    const userId = user()?.id
    if (!blipId) {
      return
    }

    try {
      await store.upsert(
        {
          id: blipId,
          content: markdown,
          // Persist ownership in cache so draft toolbars render consistently.
          ...(userId ? { user_id: userId } : {}),
          blip_type: BLIP_TYPES.ROOT,
          parent_id: null,
        },
        { cacheOnly: true },
      )

      setLastCachedContent(markdown)
      setSaveStatus("saved-cache")
      showStatusWithFade()
    } catch (error) {
      console.error("Error saving to cache:", error)
      setSaveStatus("error")
      setShowStatus(true)
    }
  }

  // Save to database (also updates cache)
  const saveToDatabase = async (markdown: string) => {
    const blipId = currentBlipId()
    const userId = user()?.id
    if (!blipId || !userId) {
      return
    }

    try {
      setSaveStatus("saving-db")
      setShowStatus(true)
      setStatusFading(false)

      const result = await store.upsert({
        id: blipId,
        content: markdown,
        user_id: userId, // Add user_id for RLS
        blip_type: BLIP_TYPES.ROOT,
        parent_id: null,
      })

      if (result.error) {
        throw new Error(result.error)
      }

      setLastDbSavedContent(markdown)
      setLastCachedContent(markdown)
      setHasPersistedCurrentBlip(true)
      setSaveStatus("saved-db")
      showStatusWithFade()
      void persistTagsToDatabase(blipId)
    } catch /* (error) */ {
      setSaveStatus("error")
      setShowStatus(true)
    }
  }

  // Helper to show status and fade it out
  const showStatusWithFade = () => {
    // Clear any existing timeouts
    if (hideStatusTimeout) {
      clearTimeout(hideStatusTimeout)
    }
    if (fadeStatusTimeout) {
      clearTimeout(fadeStatusTimeout)
    }

    setShowStatus(true)
    setStatusFading(false)

    // Show fully for 2 seconds
    fadeStatusTimeout = setTimeout(() => {
      setStatusFading(true)
    }, TIME.TWO_SECONDS)

    // Hide after 5 seconds total
    hideStatusTimeout = setTimeout(() => {
      setShowStatus(false)
      setStatusFading(false)
    }, TIME.FIVE_SECONDS)
  }

  // Debounced saves
  const debouncedCacheSave = debounce(saveToCacheOnly, TIME.FIVE_SECONDS)
  const debouncedDbSave = debounce(saveToDatabase, TIME.THIRTY_SECONDS)
  const debouncedTagSave = debounce(() => {
    void persistTagsToDatabase()
  }, TIME.THIRTY_SECONDS)

  // Initialize editor state when drawer opens
  createEffect(() => {
    if (local.open && !currentBlipId()) {
      void loadTagOptions()

      const userId = user()?.id
      if (!userId) {
        console.error("No user ID available")
        return
      }

      // If a specific blip was selected for editing, prioritize loading it.
      const requestedBlipId = local.blipId
      if (requestedBlipId) {
        const selectedBlip = store
          .entities()
          .find(b => b.id === requestedBlipId)
        if (selectedBlip) {
          openExistingBlip(selectedBlip, true)
          return
        }
      }

      if (drafts().length > 0) {
        setEditorView("picker")
        return
      }

      startNewBlip()
    }
  })

  // Reset state when drawer closes
  createEffect(() => {
    if (local.open) {
      hasOpenedAtLeastOnce = true
      setSkipClosePersist(false)
      if (resetStateTimeout) {
        clearTimeout(resetStateTimeout)
        resetStateTimeout = null
      }
      return
    }

    // Ignore initial closed state while mounted; only run close logic after
    // the drawer has been opened at least once in this mounted lifecycle.
    if (!hasOpenedAtLeastOnce) {
      return
    }

    clearEditorFocusTimeout()

    const closingBlipId = currentBlipId()
    const closingContent = content()
    const cachedContent = lastCachedContent()
    const dbSavedContent = lastDbSavedContent()
    const closingTagValues = selectedTagValues()
    const dbSavedTagValues = lastDbSavedTagValues()
    const userId = user()?.id

    // Cancel any pending saves
    debouncedCacheSave.cancel()
    debouncedDbSave.cancel()
    debouncedTagSave.cancel()

    if (!skipClosePersist()) {
      // If there are unsaved changes when closing, persist them immediately.
      // This prevents losing drafts when users close quickly and refresh.
      const hasBlipId = Boolean(closingBlipId)
      const hasContent = closingContent.trim().length > 0
      const needsCacheSave = closingContent !== cachedContent
      const needsDbSave = closingContent !== dbSavedContent
      const needsTagSave = !areTagValuesEqual(closingTagValues, dbSavedTagValues)

      if (hasBlipId && hasContent && needsCacheSave) {
        void store.upsert(
          {
            id: closingBlipId!,
            content: closingContent,
            ...(userId ? { user_id: userId } : {}),
            blip_type: BLIP_TYPES.ROOT,
            parent_id: null,
          },
          { cacheOnly: true },
        )
      }

      if (hasBlipId && hasContent && needsDbSave && userId) {
        void store.upsert({
          id: closingBlipId!,
          content: closingContent,
          user_id: userId,
          blip_type: BLIP_TYPES.ROOT,
          parent_id: null,
        })
      }

      if (hasBlipId && needsTagSave && userId) {
        void persistTagsToDatabase(closingBlipId!, closingTagValues)
      }
    }

    // Clear timeouts
    if (hideStatusTimeout) {
      clearTimeout(hideStatusTimeout)
    }
    if (fadeStatusTimeout) {
      clearTimeout(fadeStatusTimeout)
    }

    // Small delay to allow drawer animation to complete
    resetStateTimeout = setTimeout(() => {
      // If the drawer has reopened, skip this stale close-reset.
      if (local.open) {
        resetStateTimeout = null
        return
      }

      setCurrentBlipId(null)
      setContent("")
      setLastCachedContent("")
      setLastDbSavedContent("")
      setHasPersistedCurrentBlip(false)
      setLastDbSavedTagValues([])
      setSaveStatus("idle")
      setEditorView("editor")
      setSelectedTags([])
      setShowStatus(false)
      setStatusFading(false)
      setSkipClosePersist(false)
      resetStateTimeout = null
    }, TIME.HALF_SECOND)
  })
  // When creating a new blip, focus the editor immediately after open.
  createEffect(() => {
    if (
      local.open &&
      editorView() === "editor" &&
      content().trim().length === 0
    ) {
      clearEditorFocusTimeout()
      focusEditorInput()
    }
  })

  // Cleanup on unmount
  onCleanup(() => {
    debouncedCacheSave.cancel()
    debouncedDbSave.cancel()
    debouncedTagSave.cancel()
    clearEditorFocusTimeout()
    if (resetStateTimeout) {
      clearTimeout(resetStateTimeout)
      resetStateTimeout = null
    }
    if (hideStatusTimeout) {
      clearTimeout(hideStatusTimeout)
    }
    if (fadeStatusTimeout) {
      clearTimeout(fadeStatusTimeout)
    }
  })

  // Handlers
  const handleContentChange = (markdown: string) => {
    setContent(markdown)
    setSaveStatus("idle")

    if (markdown.trim() && currentBlipId()) {
      // Trigger both debounced saves
      debouncedCacheSave(markdown)
      debouncedDbSave(markdown)
      debouncedTagSave()
    }
  }

  const handleTagSelectionChange = (nextTags: BlipTagOption[]) => {
    setSelectedTags(nextTags)
    setSaveStatus("idle")

    if (currentBlipId()) {
      if (hasPersistedCurrentBlip()) {
        debouncedTagSave()
      } else {
        debouncedDbSave(content())
      }
    }
  }

  const handleSave = async () => {
    // Cancel pending saves
    debouncedCacheSave.cancel()
    debouncedDbSave.cancel()
    debouncedTagSave.cancel()

    // Save to database immediately
    await saveToDatabase(content())
  }

  const handlePublish = async () => {
    const blipId = currentBlipId()
    if (!blipId) {
      console.error("Cannot publish: no blip ID")
      return
    }

    try {
      debouncedCacheSave.cancel()
      debouncedDbSave.cancel()
      debouncedTagSave.cancel()

      if (content() !== lastDbSavedContent()) {
        await saveToDatabase(content())
      }

      setSaveStatus("saving-db")
      setShowStatus(true)

      const currentPublishedState = isPublished()

      if (currentPublishedState) {
        await store.unpublish(blipId)
        // setIsPublished(false)
      } else {
        await store.publish(blipId)
        // setIsPublished(true)
      }

      setSaveStatus("saved-db")
      showStatusWithFade()

      // Close drawer after publishing
      if (!currentPublishedState) {
        local.close()
      }
    } catch (error) {
      console.error("Error toggling publish state:", error)
      setSaveStatus("error")
      setShowStatus(true)
    }
  }

  const handleDelete = async () => {
    const blipId = currentBlipId()
    if (!blipId) {
      return
    }

    confirm({
      title: tr("confirmDelete.title"),
      prompt: tr("confirmDelete.prompt"),
      variant: "destructive",
      confirmationActionLabel: tr("confirmDelete.actions.confirm"),
      confirmationActionLoadingLabel: tr("confirmDelete.actions.confirming"),
      cancelActionLabel: tr("confirmDelete.actions.cancel"),
      onConfirm: async () => {
        try {
          await store.remove(blipId)
          setSkipClosePersist(true)
          local.close()
        } catch (error) {
          console.error("Error deleting blip:", error)
          setSkipClosePersist(false)
          setSaveStatus("error")
          setShowStatus(true)
        }
      },
    })
  }

  const hasPendingChanges = () =>
    content() !== lastCachedContent() ||
    !areTagValuesEqual(selectedTagValues(), lastDbSavedTagValues())

  // Prevent viewport zoom/scale when drawer is open
  createEffect(() => {
    const isOpen = local.open

    withWindow(() => {
      /* eslint-disable-next-line quotes */
      const viewport = document.querySelector('meta[name="viewport"]')
      if (!viewport) {
        return
      }

      if (isOpen) {
        windowScrollYOnOpen = window.scrollY

        viewport?.setAttribute(
          "content",
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
        )
      } else {
        viewport?.setAttribute(
          "content",
          "width=device-width, initial-scale=1.0",
        )

        window.scrollTo(0, windowScrollYOnOpen)
      }
    })
  })

  const handleOpenChange = (open: boolean) => {
    local.onPanelOpenChange(open)
  }

  const isBlipTagsContentTarget = (target: EventTarget | null) =>
    target instanceof Element && target.closest(".blip-tags-content")

  const getStatusText = () => {
    const status = saveStatus()

    switch (status) {
      case "saving-cache":
      case "saving-db":
        return tr("status.saving")
      case "saved-cache":
      case "saved-db":
        return tr("status.saved")
      case "error":
        return tr("status.error")
      default:
        return ""
    }
  }

  const getStatusIcon = () => {
    const status = saveStatus()

    if (status === "saving-cache" || status === "saving-db") {
      return <LoadingSpinner size="0.75rem" />
    }

    if (status === "saved-cache") {
      return (
        <Icon
          name="save"
          class="status-saved-icon"
        />
      )
    }

    if (status === "saved-db") {
      return (
        <Icon
          name="cloud_upload"
          class="status-saved-icon"
        />
      )
    }

    return null
  }

  const StatusBarActions = (ctx: any) => {
    return (
      <Stack
        orient="row"
        justify="end"
        gap="0.25rem">
        <Show when={!ctx.isPublished && ctx.hasBlipId}>
          <IconButton
            size="xs"
            icon="delete"
            class="blip-action-delete"
            aria-label={tr("actions.delete")}
            onClick={ctx.handleDelete}
            // Prevent this button from stealing focus
            // which causes the soft keyboard to close
            // when it is open on mobile devices and the
            // user taps this button to toggle the toolbar
            onMouseDown={e => e.preventDefault()}
          />
        </Show>
        <IconButton
          size="xs"
          icon={ctx.isPublished ? "check_circle" : "arrow_upload_ready"}
          disabled={!ctx.hasBlipId || ctx.hasPendingChanges}
          onClick={ctx.handlePublish}
          class={cx("blip-action-publish", {
            published: ctx.isPublished,
            unpublished: !ctx.isPublished,
          })}
          aria-label={
            ctx.isPublished ? tr("actions.unpublish") : tr("actions.publish")
          }
          // Prevent this button from stealing focus
          // which causes the soft keyboard to close
          // when it is open on mobile devices and the
          // user taps this button to toggle the toolbar
          onMouseDown={e => e.preventDefault()}
        />
        <IconButton
          size="xs"
          icon="cloud_upload"
          class="blip-action-save"
          aria-label={tr("actions.save")}
          disabled={!ctx.hasPendingChanges}
          onClick={ctx.handleSave}
          // Prevent this button from stealing focus
          // which causes the soft keyboard to close
          // when it is open on mobile devices and the
          // user taps this button to toggle the toolbar
          onMouseDown={e => e.preventDefault()}
        />
      </Stack>
    )
  }

  const EditorCloseButton = () => (
    <span class="blip-editor-close-label">{tr("actions.close")}</span>
  )

  return (
    <Drawer
      side="bottom"
      open={local.open}
      onOpenChange={handleOpenChange}
      class={cx("blip-editor-container", {
        "blip-editor-container--picker": editorView() === "picker",
      })}
      contentRef={setComboboxPortalMount}
      showTrigger={false}
      showClose
      closeClass="blip-editor-close"
      Close={EditorCloseButton}
      closeAriaLabel={tr("actions.close")}
      drawerProps={{
        closeOnOutsideFocus: false,
        closeOnOutsidePointer: false,
        onOutsidePointer: event => {
          if (isBlipTagsContentTarget(event.target)) {
            event.preventDefault()
          }
        },
      }}>
      <Stack>
        <div class="handle" />
        <Show when={local.open}>
          <Show
            when={editorView() === "picker"}
            fallback={
              <form>
                <MarkdownEditor
                  instanceKey="blip-editor"
                  placeholder={tr("placeholder")}
                  initialValue={content()}
                  onChange={handleContentChange}
                  BelowEditor={() => (
                    <BlipTags
                      aria-label={tr("tags.ariaLabel")}
                      placeholder={tr("tags.placeholder")}
                      freeSolo
                      options={tagOptions()}
                      value={selectedTags()}
                      onChange={handleTagSelectionChange}
                      portalMount={comboboxPortalMount()}
                    />
                  )}
                  statusText={getStatusText()}
                  statusIcon={getStatusIcon()}
                  showStatus={showStatus()}
                  statusFading={statusFading()}
                  statusActions={StatusBarActions}
                  statusContext={{
                    isPublished: isPublished(),
                    hasBlipId: Boolean(currentBlipId()),
                    hasPendingChanges: hasPendingChanges(),
                    handleDelete,
                    handlePublish,
                    handleSave,
                  }}
                />
              </form>
            }>
            <Stack
              class="blip-draft-picker"
              gap="0.5rem">
              <button
                type="button"
                class="blip-draft-picker-item new"
                onClick={startNewBlip}>
                <BlipIcon
                  size="1rem"
                  class="blip-new-icon"
                  blipColor="var(--colors-scarlett)"
                />
                <span>{tr("draftPicker.new")}</span>
              </button>
              <For each={drafts()}>
                {draft => (
                  <button
                    type="button"
                    class="blip-draft-picker-item"
                    onClick={() => openExistingBlip(draft)}>
                    <Icon name="edit_note" />
                    <span>{getDraftLabel(draft)}</span>
                  </button>
                )}
              </For>
            </Stack>
          </Show>
        </Show>
      </Stack>
    </Drawer>
  )
}
