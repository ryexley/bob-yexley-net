import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  splitProps,
  Show,
  untrack,
} from "solid-js"
import { DateTimePicker } from "@/components/date-time-picker"
import { Stack } from "@/components/stack"
import { Switch } from "@/components/switch"
import {
  MarkdownEditor,
  type MarkdownEditorControlsProps,
  type MarkdownEditorContentMetrics,
  getMarkdownEditorContentMetrics,
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
import { useViewport } from "@/context/viewport"
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
type EditorSurfaceView = "editor" | "metadata"

const tr = ptr("blips.components.blipEditor")
const DESKTOP_LAYOUT_BREAKPOINT_PX = 768
const DESKTOP_SHELL_MIN_WIDTH_PX = 30 * 16
const DESKTOP_SHELL_MAX_WIDTH_PX = 48 * 16
const DESKTOP_SHELL_MIN_HEIGHT_PX = 16 * 16
const DESKTOP_SHELL_MAX_HEIGHT_PX = 44 * 16
const DESKTOP_SHELL_VIEWPORT_MARGIN_PX = 32

type BlipEditorDesktopSizePreset = {
  minCharacters: number
  minWords: number
  widthPx: number
  maxHeightPx: number
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const BLIP_EDITOR_DESKTOP_SIZE_PRESETS: Record<
  "compact" | "roomy" | "article" | "essay",
  BlipEditorDesktopSizePreset
> = {
  compact: {
    minCharacters: 0,
    minWords: 0,
    widthPx: DESKTOP_SHELL_MIN_WIDTH_PX,
    maxHeightPx: 26 * 16,
  },
  roomy: {
    minCharacters: 420,
    minWords: 75,
    widthPx: 38 * 16,
    maxHeightPx: 32 * 16,
  },
  article: {
    minCharacters: 1200,
    minWords: 220,
    widthPx: 46 * 16,
    maxHeightPx: 38 * 16,
  },
  essay: {
    minCharacters: 2200,
    minWords: 380,
    widthPx: DESKTOP_SHELL_MAX_WIDTH_PX,
    maxHeightPx: DESKTOP_SHELL_MAX_HEIGHT_PX,
  },
}

export const getDesktopSizePreset = (metrics: MarkdownEditorContentMetrics) => {
  const presetEntries = Object.values(BLIP_EDITOR_DESKTOP_SIZE_PRESETS)

  return presetEntries.reduce((selectedPreset, preset) => {
    const meetsCharacterThreshold =
      metrics.characterCount >= preset.minCharacters
    const meetsWordThreshold = metrics.wordCount >= preset.minWords

    if (meetsCharacterThreshold || meetsWordThreshold) {
      return preset
    }

    return selectedPreset
  }, BLIP_EDITOR_DESKTOP_SIZE_PRESETS.compact)
}

const normalizeTimestamp = (value?: string | null) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

const toDateValue = (value?: string | null) => {
  const normalized = normalizeTimestamp(value)
  return normalized ? new Date(normalized) : null
}

const getInitialPublishAt = (blip?: Pick<Blip, "publish_at" | "created_at"> | null) =>
  normalizeTimestamp(blip?.publish_at ?? blip?.created_at ?? null)

const areTimestampsEqual = (left?: string | null, right?: string | null) =>
  (normalizeTimestamp(left) ?? null) === (normalizeTimestamp(right) ?? null)

export function BlipEditor(props: BlipEditorProps) {
  const [local] = splitProps(props, [
    "open",
    "onPanelOpenChange",
    "close",
    "blipId",
  ])
  const supabase = useSupabase()
  const { user } = useAuth() as any
  const viewport = useViewport()
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
  const [editorSurfaceView, setEditorSurfaceView] =
    createSignal<EditorSurfaceView>("editor")
  const [skipClosePersist, setSkipClosePersist] = createSignal<boolean>(false)
  const [keyboardInsetPx, setKeyboardInsetPx] = createSignal<number>(0)
  const [viewportTopPx, setViewportTopPx] = createSignal<number>(0)
  const [isEditorMounted, setIsEditorMounted] = createSignal(false)
  const [contentMetrics, setContentMetrics] =
    createSignal<MarkdownEditorContentMetrics>(getMarkdownEditorContentMetrics(""))
  const [allowComments, setAllowComments] = createSignal(true)
  const [lastCachedAllowComments, setLastCachedAllowComments] = createSignal(true)
  const [lastDbSavedAllowComments, setLastDbSavedAllowComments] = createSignal(true)
  const [publishAt, setPublishAt] = createSignal<string | null>(null)
  const [lastCachedPublishAt, setLastCachedPublishAt] = createSignal<string | null>(
    null,
  )
  const [lastDbSavedPublishAt, setLastDbSavedPublishAt] = createSignal<string | null>(
    null,
  )
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
    shouldAutoFocusOnOpen: () => true,
    shouldUseFocusProxy: () => true,
  })

  const preventEditorBlur = (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
  }

  const isMobileViewport = () => viewport.width() < DESKTOP_LAYOUT_BREAKPOINT_PX

  const releaseEditorFocusForMetadata = (reason: string) => {
    if (typeof document === "undefined") {
      return
    }

    const blurEditorElements = () => {
      const scope = comboboxPortalMount() ?? document
      const activeElement = document.activeElement as HTMLElement | null

      if (activeElement && scope.contains(activeElement)) {
        activeElement.blur?.()
      }

      const proseMirror = scope.querySelector(".ProseMirror") as HTMLElement | null
      proseMirror?.blur?.()

      const activeEditable = scope.querySelector(
        '[contenteditable="true"]',
      ) as HTMLElement | null
      activeEditable?.blur?.()
    }

    focusBridge.clearTextInputSession(reason)
    blurEditorElements()

    queueMicrotask(() => {
      blurEditorElements()
    })

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        blurEditorElements()
      })
    }
  }

  const handleMetadataToggleMouseDown = (event: MouseEvent) => {
    const nextView = editorSurfaceView() === "metadata" ? "editor" : "metadata"

    if (nextView === "metadata" && isMobileViewport()) {
      releaseEditorFocusForMetadata("blipEditor.metadataToggleMouseDown")
      return
    }

    preventEditorBlur(event)
  }

  const handleMetadataToggleTouchStart = (event: TouchEvent) => {
    const nextView = editorSurfaceView() === "metadata" ? "editor" : "metadata"

    if (nextView === "metadata" && isMobileViewport()) {
      releaseEditorFocusForMetadata("blipEditor.metadataToggleTouchStart")
      return
    }

    preventEditorBlur(event)
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
    setContentMetrics(getMarkdownEditorContentMetrics(""))
    setAllowComments(true)
    setLastCachedAllowComments(true)
    setLastDbSavedAllowComments(true)
    setPublishAt(null)
    setLastCachedPublishAt(null)
    setLastDbSavedPublishAt(null)
    setSelectedTags([])
    setLastDbSavedTagValues([])
    setSaveStatus("idle")
    setEditorView("editor")
    setEditorSurfaceView("editor")
    focusBridge.scheduleFocusAfterOpen()
  }

  const openExistingBlip = (selectedBlip: Blip, assumePersisted = false) => {
    const selectedContent = selectedBlip.content || ""
    const selectedAllowComments = selectedBlip.allow_comments ?? true
    const selectedPublishAt = getInitialPublishAt(selectedBlip)
    setCurrentBlipId(selectedBlip.id)
    setContent(selectedContent)
    setLastCachedContent(selectedContent)
    setLastDbSavedContent(assumePersisted ? selectedContent : "")
    setHasPersistedCurrentBlip(assumePersisted)
    setContentMetrics(getMarkdownEditorContentMetrics(selectedContent))
    setAllowComments(selectedAllowComments)
    setLastCachedAllowComments(selectedAllowComments)
    setLastDbSavedAllowComments(selectedAllowComments)
    setPublishAt(selectedPublishAt)
    setLastCachedPublishAt(selectedPublishAt)
    setLastDbSavedPublishAt(selectedPublishAt)
    setSelectedTags([])
    setLastDbSavedTagValues([])
    setSaveStatus("idle")
    setEditorView("editor")
    setEditorSurfaceView("editor")
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
      return true
    }

    const result = await tags.replaceBlipTags(blipId, values)
    if (result.error) {
      console.error("Error persisting blip tags:", result.error)
      return false
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

    return true
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
      const nextAllowComments = allowComments()
      const nextPublishAt = publishAt()
      await startSavingStatus("saving-cache")

      await store.upsert(
        {
          id: blipId,
          content: markdown,
          allow_comments: nextAllowComments,
          publish_at: nextPublishAt,
          tags: selectedTagValues(),
          // Persist ownership in cache so draft toolbars render consistently.
          ...(userId ? { user_id: userId } : {}),
          blip_type: BLIP_TYPES.ROOT,
          parent_id: null,
        },
        { cacheOnly: true },
      )

      await waitForMinimumSavingIndicator(saveStartedAt)
      setLastCachedContent(markdown)
      setLastCachedAllowComments(nextAllowComments)
      setLastCachedPublishAt(nextPublishAt)
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
      return false
    }

    try {
      const saveStartedAt = Date.now()
      const nextAllowComments = allowComments()
      const nextPublishAt = publishAt()
      await startSavingStatus("saving-db")

      const result = await store.upsert({
        id: blipId,
        content: markdown,
        allow_comments: nextAllowComments,
        publish_at: nextPublishAt,
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
      setLastDbSavedAllowComments(nextAllowComments)
      setLastCachedAllowComments(nextAllowComments)
      setLastDbSavedPublishAt(nextPublishAt)
      setLastCachedPublishAt(nextPublishAt)
      setHasPersistedCurrentBlip(true)
      setSaveStatus("saved-db")
      showStatusWithFade()
      void persistTagsToDatabase(blipId)
      return true
    } catch /* (error) */ {
      setSaveStatus("error")
      setShowStatus(true)
      return false
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

  const persistPendingChangesBeforeClose = async () => {
    const closingBlipId = currentBlipId()
    const closingContent = content()
    const cachedContent = lastCachedContent()
    const dbSavedContent = lastDbSavedContent()
    const closingAllowComments = allowComments()
    const cachedAllowComments = lastCachedAllowComments()
    const dbSavedAllowComments = lastDbSavedAllowComments()
    const closingPublishAt = publishAt()
    const cachedPublishAt = lastCachedPublishAt()
    const dbSavedPublishAt = lastDbSavedPublishAt()
    const closingTagValues = selectedTagValues()
    const dbSavedTagValues = lastDbSavedTagValues()
    const userId = user()?.id
    const hasBlipId = Boolean(closingBlipId)
    const hasContent = closingContent.trim().length > 0
    const canPersistCurrentBlip =
      hasBlipId && (hasContent || hasPersistedCurrentBlip())
    const needsCacheSave =
      closingContent !== cachedContent ||
      closingAllowComments !== cachedAllowComments ||
      !areTimestampsEqual(closingPublishAt, cachedPublishAt)
    const needsDbSave =
      closingContent !== dbSavedContent ||
      closingAllowComments !== dbSavedAllowComments ||
      !areTimestampsEqual(closingPublishAt, dbSavedPublishAt)
    const needsTagSave = !areTagValuesEqual(closingTagValues, dbSavedTagValues)

    if (!canPersistCurrentBlip) {
      return true
    }

    if (needsCacheSave) {
      const cacheResult = await store.upsert(
        {
          id: closingBlipId!,
          content: closingContent,
          allow_comments: closingAllowComments,
          publish_at: closingPublishAt,
          ...(userId ? { user_id: userId } : {}),
          blip_type: BLIP_TYPES.ROOT,
          parent_id: null,
        },
        { cacheOnly: true },
      )

      if (cacheResult.error) {
        console.error("Error saving root draft to local cache:", cacheResult.error)
        setSaveStatus("error")
        setShowStatus(true)
        return false
      }

      setLastCachedContent(closingContent)
      setLastCachedAllowComments(closingAllowComments)
      setLastCachedPublishAt(closingPublishAt)
    }

    if (needsDbSave) {
      if (!userId) {
        console.error("Cannot sync root draft without an authenticated user")
        setSaveStatus("error")
        setShowStatus(true)
        return false
      }

      const dbResult = await store.upsert({
        id: closingBlipId!,
        content: closingContent,
        allow_comments: closingAllowComments,
        publish_at: closingPublishAt,
        user_id: userId,
        blip_type: BLIP_TYPES.ROOT,
        parent_id: null,
      })

      if (dbResult.error) {
        console.error("Error syncing root draft to cloud:", dbResult.error)
        setSaveStatus("error")
        setShowStatus(true)
        return false
      }

      setLastDbSavedContent(closingContent)
      setLastCachedContent(closingContent)
      setLastDbSavedAllowComments(closingAllowComments)
      setLastCachedAllowComments(closingAllowComments)
      setLastDbSavedPublishAt(closingPublishAt)
      setLastCachedPublishAt(closingPublishAt)
      setHasPersistedCurrentBlip(true)
    }

    if (hasBlipId && needsTagSave) {
      if (!userId) {
        console.error("Cannot sync root draft tags without an authenticated user")
        setSaveStatus("error")
        setShowStatus(true)
        return false
      }

      const tagsPersisted = await persistTagsToDatabase(
        closingBlipId!,
        closingTagValues,
      )
      if (!tagsPersisted) {
        setSaveStatus("error")
        setShowStatus(true)
        return false
      }
    }

    return true
  }

  const requestCloseEditor = async () => {
    debouncedCacheSave.cancel()
    debouncedDbSave.cancel()

    if (!skipClosePersist()) {
      const persisted = await persistPendingChangesBeforeClose()
      if (!persisted) {
        return
      }
    }

    setSkipClosePersist(true)
    local.onPanelOpenChange(false)
  }

  // Initialize editor state when the root editor receives a fresh open request.
  // This avoids mobile fast close/reopen races preserving a stale `currentBlipId`
  // and skipping the draft picker when the user explicitly asked for "new blip".
  createEffect(
    on(
      () => [local.open, local.blipId] as const,
      ([open, requestedBlipId], previous) => {
        if (!open) {
          return
        }

        const [previousOpen, previousRequestedBlipId] = previous ?? [false, null]
        const isFreshOpen = !previousOpen
        const targetChanged = requestedBlipId !== previousRequestedBlipId

        if (!isFreshOpen && !targetChanged) {
          return
        }

        void loadTagOptions()

        const userId = user()?.id
        if (!userId) {
          console.error("No user ID available")
          return
        }

        if (requestedBlipId) {
          const selectedBlip = store
            .entities()
            .find(b => b.id === requestedBlipId)
          if (selectedBlip) {
            openExistingBlip(selectedBlip, true)
          }
          return
        }

        if (drafts().length > 0) {
          setEditorView("picker")
          setEditorSurfaceView("editor")
          return
        }

        startNewBlip()
      },
    ),
  )

  // Reset state when drawer closes
  createEffect(
    on(
      () => local.open,
      open => {
        if (open) {
          hasOpenedAtLeastOnce = true
          setSkipClosePersist(false)
          setIsEditorMounted(true)
          focusBridge.cancelTextInputSessionCleanup()
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

        // Cancel any pending saves
        debouncedCacheSave.cancel()
        debouncedDbSave.cancel()

        if (!skipClosePersist()) {
          void persistPendingChangesBeforeClose()
        }

        // Clear timeouts
        focusBridge.clearTextInputSession("blipEditor.close")
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
          setContentMetrics(getMarkdownEditorContentMetrics(""))
          setAllowComments(true)
          setLastCachedAllowComments(true)
          setLastDbSavedAllowComments(true)
          setPublishAt(null)
          setLastCachedPublishAt(null)
          setLastDbSavedPublishAt(null)
          setLastDbSavedTagValues([])
          setSaveStatus("idle")
          setEditorView("editor")
          setEditorSurfaceView("editor")
          setSelectedTags([])
          setShowStatus(false)
          setStatusFading(false)
          setSkipClosePersist(false)
          setIsEditorMounted(false)
          restoreEditorDocumentInteractionState()
          resetStateTimeout = null
        }, TIME.HALF_SECOND)
      },
    ),
  )
  // Cleanup on unmount
  onCleanup(() => {
    debouncedCacheSave.cancel()
    debouncedDbSave.cancel()
    if (resetStateTimeout) {
      clearTimeout(resetStateTimeout)
      resetStateTimeout = null
    }
    focusBridge.clearTextInputSession("blipEditor.cleanup")
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
    }
  }

  const handleAllowCommentsChange = (nextAllowComments: boolean) => {
    setAllowComments(nextAllowComments)
    setSaveStatus("idle")

    if (currentBlipId() && (content().trim() || hasPersistedCurrentBlip())) {
      debouncedCacheSave(content())
      debouncedDbSave(content())
    }
  }

  const handlePublishAtChange = (nextPublishAt: Date | null) => {
    setPublishAt(nextPublishAt ? nextPublishAt.toISOString() : null)
    setSaveStatus("idle")

    if (currentBlipId() && (content().trim() || hasPersistedCurrentBlip())) {
      debouncedCacheSave(content())
      debouncedDbSave(content())
    }
  }

  const handleTagSelectionChange = (nextTags: BlipTagOption[]) => {
    setSelectedTags(nextTags)
    setSaveStatus("idle")

    if (!currentBlipId()) {
      return
    }

    if (content().trim() || hasPersistedCurrentBlip()) {
      debouncedCacheSave(content())
      debouncedDbSave(content())
    } else {
      // Stub blip with empty body: tee up first cloud persist like the previous
      // tag-specific debounce, so tag-only edits are not stranded pre-upsert.
      debouncedDbSave(content())
    }
  }

  const handleSave = async () => {
    // Cancel pending saves
    debouncedCacheSave.cancel()
    debouncedDbSave.cancel()

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

      if (hasPendingChanges()) {
        const saved = await saveToDatabase(content())
        if (!saved) {
          return
        }
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
    content() !== lastDbSavedContent() ||
    allowComments() !== lastDbSavedAllowComments() ||
    !areTimestampsEqual(publishAt(), lastDbSavedPublishAt()) ||
    !areTagValuesEqual(selectedTagValues(), lastDbSavedTagValues())

  const handleToggleMetadataView = () => {
    const nextView = editorSurfaceView() === "metadata" ? "editor" : "metadata"

    if (nextView === "metadata" && isMobileViewport()) {
      releaseEditorFocusForMetadata("blipEditor.metadataOpen")
    }

    setEditorSurfaceView(nextView)

    if (nextView === "editor") {
      focusBridge.scheduleFocusAfterOpen()
    }
  }

  const handleContentMetricsChange = (
    nextMetrics: MarkdownEditorContentMetrics,
  ) => {
    setContentMetrics(current =>
      current.characterCount === nextMetrics.characterCount &&
      current.wordCount === nextMetrics.wordCount &&
      current.paragraphCount === nextMetrics.paragraphCount
        ? current
        : nextMetrics,
    )
  }

  const desktopShellSize = createMemo(() => {
    if (
      viewport.width() < DESKTOP_LAYOUT_BREAKPOINT_PX ||
      editorView() !== "editor"
    ) {
      return null
    }

    const preset = getDesktopSizePreset(contentMetrics())
    const viewportWidthCap = clampNumber(
      viewport.width() - DESKTOP_SHELL_VIEWPORT_MARGIN_PX,
      DESKTOP_SHELL_MIN_WIDTH_PX,
      DESKTOP_SHELL_MAX_WIDTH_PX,
    )
    const viewportHeightCap = clampNumber(
      viewport.height() - DESKTOP_SHELL_VIEWPORT_MARGIN_PX,
      DESKTOP_SHELL_MIN_HEIGHT_PX,
      DESKTOP_SHELL_MAX_HEIGHT_PX,
    )

    return {
      widthPx: Math.min(preset.widthPx, viewportWidthCap),
      maxHeightPx: Math.min(preset.maxHeightPx, viewportHeightCap),
    }
  })

  const desktopShellStyle = createMemo<Record<string, string>>(() => {
    const shellSize = desktopShellSize()
    if (!shellSize) {
      return {}
    }

    return {
      "--blip-editor-shell-width": `${shellSize.widthPx}px`,
      "--blip-editor-shell-max-height": `${shellSize.maxHeightPx}px`,
    }
  })

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

  const MetadataPanel = () => {
    return (
      <div class="blip-editor-metadata-panel">
        <div class="section">
          <div class="section-label">{tr("metadata.title")}</div>
          <BlipTags
            aria-label={tr("tags.ariaLabel")}
            placeholder={tr("tags.placeholder")}
            freeSolo
            options={tagOptions()}
            value={selectedTags()}
            onChange={handleTagSelectionChange}
            portalMount={comboboxPortalMount()}
          />
        </div>
        <div class="section">
          <Switch
            label={tr("metadata.allowComments")}
            checked={allowComments()}
            onChange={handleAllowCommentsChange}
            aria-label={tr("metadata.allowComments")}
            containerClass="allow-comments"
          />
        </div>
        <div class="section">
          <DateTimePicker
            label={tr("metadata.publishAt")}
            value={toDateValue(publishAt())}
            onChange={handlePublishAtChange}
            showTime
            timeGranularity={5}
            portalMount={comboboxPortalMount()}
            containerClass="publish-at"
          />
        </div>
      </div>
    )
  }

  const EditorControls = (ctx: MarkdownEditorControlsProps) => {
    const metadataOpen = () => editorSurfaceView() === "metadata"

    return (
      <div class="blip-editor-below-editor">
        <div class="blip-editor-control-pill">
          <div class="blip-editor-control-pill-scroll">
            <div class="blip-editor-control-pill-content">
              <div class="blip-editor-control-pill-left">
                <IconButton
                  size="xs"
                  icon="close"
                  class="blip-editor-close"
                  aria-label={tr("actions.close")}
                  onClick={() => void requestCloseEditor()}
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
                  class={cx("blip-editor-metadata-toggle", {
                    "is-active": metadataOpen(),
                  })}
                  aria-label={
                    metadataOpen()
                      ? tr("actions.showEditor")
                      : tr("actions.showMetadata")
                  }
                  onClick={handleToggleMetadataView}
                  onMouseDown={handleMetadataToggleMouseDown}
                  onTouchStart={handleMetadataToggleTouchStart}>
                  <Icon name={metadataOpen() ? "edit_note" : "page_info"} />
                </button>
                <button
                  type="button"
                  class={cx("blip-editor-toolbar-toggle", {
                    "is-active": ctx.toolbarVisible,
                  })}
                  aria-label={tr("actions.toggleToolbar")}
                  disabled={metadataOpen()}
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
        onOpenChange={open => {
          if (open) {
            local.onPanelOpenChange(true)
            return
          }

          void requestCloseEditor()
        }}
        modal
        preventScroll
        overlayClass="blip-editor-overlay"
        class={cx("blip-editor-dialog", {
          "blip-editor-dialog--picker": editorView() === "picker",
        })}
        style={{
          "--blip-editor-keyboard-inset": `${keyboardInsetPx()}px`,
          "--blip-editor-viewport-top": `${viewportTopPx()}px`,
          ...desktopShellStyle(),
        }}
        contentProps={{
          // Mount metadata overlays to the dialog content element itself so
          // they stay within the modal subtree but can still escape the
          // editor shell's overflow clipping on desktop.
          ref: element => setComboboxPortalMount(element),
          onOpenAutoFocus: handleDialogOpenAutoFocus,
          onCloseAutoFocus: event => event.preventDefault(),
        }}>
        <EditorShell
          focusProxyRef={focusBridge.setFocusProxyRef}
          focusProxyAriaLabel={tr("placeholder")}
          showFocusProxy
          Header={
            <Show when={editorView() === "picker"}>
              <div class="blip-editor-picker-header">
                <IconButton
                  size="xs"
                  icon="close"
                  class="blip-editor-picker-close"
                  aria-label={tr("actions.close")}
                  onClick={() => void requestCloseEditor()}
                  onMouseDown={preventEditorBlur}
                />
              </div>
            </Show>
          }>
          <Show
            when={editorView() === "picker"}
            fallback={
              <form class="blip-editor-form">
                <MarkdownEditor
                  instanceKey="blip-editor"
                  MetadataPanel={MetadataPanel}
                  metadataPanelVisible={editorSurfaceView() === "metadata"}
                  focusNonce={editorFocusNonce()}
                  focusCaretPlacement="end"
                  placeholder={tr("placeholder")}
                  initialValue={content()}
                  onChange={handleContentChange}
                  onContentMetricsChange={handleContentMetricsChange}
                  EditorControls={EditorControls}
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
