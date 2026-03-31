import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  splitProps,
  Show,
  untrack,
} from "solid-js"
import { Stack } from "@/components/stack"
import {
  MarkdownEditor,
  type MarkdownEditorBelowEditorProps,
} from "@/components/markdown/editor"
import { IconButton } from "@/components/icon-button"
import { Blip as BlipIcon, Icon, LoadingSpinner } from "@/components/icon"
import { useConfirm } from "@/components/confirm-dialog"
import { Dialog } from "@/components/dialog"
import {
  BlipTags,
  type BlipTagOption,
} from "@/modules/blips/components/blip-tags"
import { restoreEditorDocumentInteractionState } from "@/modules/blips/components/editor-document-recovery"
import { createEditorFocusBridge } from "@/modules/blips/components/editor-focus-bridge"
import { useEditorMobileViewportRuntime } from "@/modules/blips/components/editor-mobile-viewport-runtime"
import { EditorShell } from "@/modules/blips/components/editor-shell"
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

  const store = blipStore(supabase.client, { subscribe: false })
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
  const [editorFocusNonce, setEditorFocusNonce] = createSignal(0)
  const [editorView, setEditorView] = createSignal<EditorView>("editor")
  const [skipClosePersist, setSkipClosePersist] = createSignal<boolean>(false)
  const [keyboardInsetPx, setKeyboardInsetPx] = createSignal<number>(0)
  const [viewportTopPx, setViewportTopPx] = createSignal<number>(0)
  const [isEditorMounted, setIsEditorMounted] = createSignal(false)
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

    const blip = store.getById(id)
    return blip?.published ?? false
  })

  let hideStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let fadeStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let resetStateTimeout: ReturnType<typeof setTimeout> | null = null
  let hasOpenedAtLeastOnce = false
  const MIN_SAVING_INDICATOR_MS = 350
  const FOCUS_AFTER_OPEN_DELAY_MS = 220

  const requestEditorFocus = () => {
    setEditorFocusNonce(previous => previous + 1)
  }
  const focusBridge = createEditorFocusBridge({
    defaultDelayMs: FOCUS_AFTER_OPEN_DELAY_MS,
    requestEditorFocus,
  })

  const preventEditorBlur = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
  }

  const waitForNextPaint = async () => {
    await new Promise<void>(resolve => {
      if (typeof window === "undefined") {
        resolve()
        return
      }

      window.requestAnimationFrame(() => {
        resolve()
      })
    })
  }

  const clearStatusTimers = () => {
    if (hideStatusTimeout) {
      clearTimeout(hideStatusTimeout)
      hideStatusTimeout = null
    }

    if (fadeStatusTimeout) {
      clearTimeout(fadeStatusTimeout)
      fadeStatusTimeout = null
    }
  }

  const startSavingStatus = async (status: SaveStatus) => {
    clearStatusTimers()
    setStatusFading(false)
    setSaveStatus(status)
    setShowStatus(true)
    await waitForNextPaint()
    await waitForNextPaint()
  }

  const handleDialogOpenAutoFocus = (event: Event) => {
    if (editorView() !== "editor") {
      return
    }

    event.preventDefault()
    focusBridge.scheduleFocusAfterOpen()
  }

  const waitForMinimumSavingIndicator = async (startedAt: number) => {
    const elapsed = Date.now() - startedAt
    const remaining = MIN_SAVING_INDICATOR_MS - elapsed

    if (remaining <= 0) {
      return
    }

    await new Promise(resolve => {
      setTimeout(resolve, remaining)
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
    focusBridge.scheduleFocusAfterOpen()
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
    focusBridge.scheduleFocusAfterOpen()
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

    const existingBlip = store.getById(blipId)
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
      const saveStartedAt = Date.now()
      await startSavingStatus("saving-cache")

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

      await waitForMinimumSavingIndicator(saveStartedAt)
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
      const saveStartedAt = Date.now()
      await startSavingStatus("saving-db")

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

      await waitForMinimumSavingIndicator(saveStartedAt)
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
  const debouncedCacheSave = debounce(
    (markdown: string) => void untrack(() => saveToCacheOnly(markdown)),
    TIME.FIVE_SECONDS,
  )
  const debouncedDbSave = debounce(
    (markdown: string) => void untrack(() => saveToDatabase(markdown)),
    TIME.THIRTY_SECONDS,
  )
  const debouncedTagSave = debounce(() => {
    void untrack(() => persistTagsToDatabase())
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
      setIsEditorMounted(true)
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
    focusBridge.clearScheduledFocus()
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
      setIsEditorMounted(false)
      restoreEditorDocumentInteractionState()
      resetStateTimeout = null
    }, TIME.HALF_SECOND)
  })
  // Cleanup on unmount
  onCleanup(() => {
    debouncedCacheSave.cancel()
    debouncedDbSave.cancel()
    debouncedTagSave.cancel()
    if (resetStateTimeout) {
      clearTimeout(resetStateTimeout)
      resetStateTimeout = null
    }
    focusBridge.clearScheduledFocus()
    if (hideStatusTimeout) {
      clearTimeout(hideStatusTimeout)
    }
    if (fadeStatusTimeout) {
      clearTimeout(fadeStatusTimeout)
    }
    restoreEditorDocumentInteractionState()
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

      await startSavingStatus("saving-db")

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

  useEditorMobileViewportRuntime({
    isOpen: () => local.open,
    setKeyboardInsetPx,
    setViewportTopPx,
  })

  const getStatusIcon = () => {
    const status = saveStatus()

    if (status === "saving-cache" || status === "saving-db") {
      return <LoadingSpinner class="blip-editor-status-spinner" />
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

  const EditorControls = (ctx: MarkdownEditorBelowEditorProps) => {
    return (
      <div class="blip-editor-below-editor">
        <BlipTags
          aria-label={tr("tags.ariaLabel")}
          placeholder={tr("tags.placeholder")}
          freeSolo
          options={tagOptions()}
          value={selectedTags()}
          onChange={handleTagSelectionChange}
          portalMount={comboboxPortalMount()}
        />
        <div class="blip-editor-control-pill">
          <div class="blip-editor-control-pill-scroll">
            <div class="blip-editor-control-pill-content">
              <div class="blip-editor-control-pill-left">
                <IconButton
                  size="xs"
                  icon="close"
                  class="blip-editor-close"
                  aria-label={tr("actions.close")}
                  onClick={() => local.onPanelOpenChange(false)}
                  onMouseDown={preventEditorBlur}
                />
                <div class="blip-editor-status-slot">
                  <Show when={ctx.showStatus && ctx.statusIcon}>
                    <div
                      class={cx("blip-editor-status-indicator", {
                        "fade-out": ctx.statusFading,
                      })}>
                      {ctx.statusIcon}
                    </div>
                  </Show>
                </div>
              </div>
              <div class="blip-editor-control-pill-right">
                <button
                  type="button"
                  class={cx("blip-editor-toolbar-toggle", {
                    "is-active": ctx.toolbarVisible,
                  })}
                  aria-label={tr("actions.toggleToolbar")}
                  onClick={() => ctx.onToggleToolbar()}
                  onMouseDown={preventEditorBlur}>
                  <Icon name="format_bold" />
                  <Icon name="format_italic" />
                  <Icon name="format_underlined" />
                </button>
                <div class="blip-editor-control-divider" />
                <Show when={!ctx.statusContext?.isPublished && ctx.statusContext?.hasBlipId}>
                  <IconButton
                    size="xs"
                    icon="delete"
                    class="blip-action-delete"
                    aria-label={tr("actions.delete")}
                    onClick={ctx.statusContext?.handleDelete}
                    onMouseDown={preventEditorBlur}
                  />
                </Show>
                <IconButton
                  size="xs"
                  icon={
                    ctx.statusContext?.isPublished
                      ? "check_circle"
                      : "arrow_upload_ready"
                  }
                  disabled={
                    !ctx.statusContext?.hasBlipId || ctx.statusContext?.hasPendingChanges
                  }
                  onClick={ctx.statusContext?.handlePublish}
                  class={cx("blip-action-publish", {
                    published: ctx.statusContext?.isPublished,
                    unpublished: !ctx.statusContext?.isPublished,
                  })}
                  aria-label={
                    ctx.statusContext?.isPublished
                      ? tr("actions.unpublish")
                      : tr("actions.publish")
                  }
                  onMouseDown={preventEditorBlur}
                />
                <IconButton
                  size="xs"
                  icon="cloud_upload"
                  class="blip-action-save"
                  aria-label={tr("actions.save")}
                  disabled={!ctx.statusContext?.hasPendingChanges}
                  onClick={ctx.statusContext?.handleSave}
                  onMouseDown={preventEditorBlur}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Show when={isEditorMounted()}>
      <Dialog
        open={local.open}
        onOpenChange={open => local.onPanelOpenChange(open)}
        modal
        preventScroll
        overlayClass="blip-editor-overlay"
        class={cx("blip-editor-dialog", {
          "blip-editor-dialog--picker": editorView() === "picker",
        })}
        style={{
          "--blip-editor-keyboard-inset": `${keyboardInsetPx()}px`,
          "--blip-editor-viewport-top": `${viewportTopPx()}px`,
        }}
        contentProps={{
          onOpenAutoFocus: handleDialogOpenAutoFocus,
          onCloseAutoFocus: event => event.preventDefault(),
        }}>
        <EditorShell
          focusProxyRef={focusBridge.setFocusProxyRef}
          focusProxyAriaLabel={tr("placeholder")}
          Header={
            <Show when={editorView() === "picker"}>
              <div class="blip-editor-picker-header">
                <IconButton
                  size="xs"
                  icon="close"
                  class="blip-editor-picker-close"
                  aria-label={tr("actions.close")}
                  onClick={() => local.onPanelOpenChange(false)}
                  onMouseDown={preventEditorBlur}
                />
              </div>
            </Show>
          }
          PortalLayer={
            <div
              class="blip-editor-portal-layer"
              ref={element => setComboboxPortalMount(element)}
            />
          }>
          <Show
            when={editorView() === "picker"}
            fallback={
              <form class="blip-editor-form">
                <MarkdownEditor
                  instanceKey="blip-editor"
                  focusNonce={editorFocusNonce()}
                  placeholder={tr("placeholder")}
                  initialValue={content()}
                  onChange={handleContentChange}
                  BelowEditor={EditorControls}
                  statusIcon={getStatusIcon()}
                  showStatus={showStatus()}
                  statusFading={statusFading()}
                  showStatusBar={false}
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
        </EditorShell>
      </Dialog>
    </Show>
  )
}
