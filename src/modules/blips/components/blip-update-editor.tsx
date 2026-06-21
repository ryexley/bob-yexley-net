import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Show,
  splitProps,
} from "solid-js"
import { revalidate } from "@solidjs/router"
import {
  MarkdownEditor,
  type MarkdownEditorControlsProps,
} from "@/components/markdown/editor"
import { Icon, LoadingSpinner } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { useConfirm } from "@/components/confirm-dialog"
import { Dialog, DialogTitle } from "@/components/dialog"
import { restoreEditorDocumentInteractionState } from "@/modules/blips/components/editor-document-recovery"
import {
  clearActiveTextInputSession,
  createEditorFocusBridge,
} from "@/modules/blips/components/editor-focus-bridge"
import { useEditorMobileViewportRuntime } from "@/modules/blips/components/editor-mobile-viewport-runtime"
import { EditorShell } from "@/modules/blips/components/editor-shell"
import { ptr } from "@/i18n"
import { debounce } from "@/util/debounce"
import { TIME } from "@/util/enums"
import { clsx as cx } from "@/util"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { useViewport } from "@/context/viewport"
import { BLIP_TYPES, blipId, blipStore, type Blip } from "@/modules/blips/data"
import { PortaledInlineTransition } from "@/modules/blips/components/portaled-inline-transition"
import {
  type Attachment,
  ComposerPreviewModal,
  MediaButton,
  type MediaStore,
  mediaStore,
  ComposerMediaChrome,
  validateMediaFiles,
} from "@/modules/media"
import { getBlipMediaFor } from "@/modules/media/data/queries"
import "./blip-update-editor.css"

type BlipUpdateEditorProps = {
  open: boolean
  rootBlipId?: string | null
  editingUpdateId?: string | null
  desktopMount?: HTMLDivElement | null
  focusNonce?: number
  closeRequestNonce?: number
  onRequestClose?: () => void
}

type SaveStatus = "idle" | "saving-db" | "saved-db" | "error"
type SaveContext = {
  updateId: string
  rootBlipId: string
  userId: string
}

const trDetail = ptr("blips.views.detail")
const trEditor = ptr("blips.components.blipEditor")
const MOBILE_MAX_WIDTH = 768

/** First media attach on a new update persists an FK stub — unpublished in DB only. */
export const resolveMediaTriggeredUpdatePersistPublished = (
  hasPersistedCurrentUpdate: boolean,
  isPublished: boolean,
): boolean => {
  if (!hasPersistedCurrentUpdate) {
    return false
  }

  return isPublished
}

export const resolveUpdateCanSave = ({
  open,
  hasSaveContext,
  hasPendingTextChanges,
  hasReadyMedia,
  hasPersistedCurrentUpdate,
}: {
  open: boolean
  hasSaveContext: boolean
  hasPendingTextChanges: boolean
  hasReadyMedia: boolean
  hasPersistedCurrentUpdate: boolean
}): boolean => {
  if (!open || !hasSaveContext) {
    return false
  }

  if (hasPendingTextChanges) {
    return true
  }

  return hasReadyMedia && !hasPersistedCurrentUpdate
}

export const resolveUpdateHasComposeDraft = ({
  hasText,
  hasMedia,
}: {
  hasText: boolean
  hasMedia: boolean
}): boolean => hasText || hasMedia

export const resolveUpdateEditorDraft = ({
  editingUpdateId,
  existingUpdate,
  nextNewUpdateId,
}: {
  editingUpdateId?: string | null
  existingUpdate?: Blip | null
  nextNewUpdateId: string
}) => {
  if (editingUpdateId) {
    if (!existingUpdate || existingUpdate.blip_type !== BLIP_TYPES.UPDATE) {
      return {
        updateId: editingUpdateId,
        content: "",
        lastSavedContent: "",
        isPublished: true,
        hasPersistedCurrentUpdate: false,
      }
    }

    return {
      updateId: existingUpdate.id,
      content: existingUpdate.content ?? "",
      lastSavedContent: existingUpdate.content ?? "",
      isPublished: existingUpdate.published,
      hasPersistedCurrentUpdate: true,
    }
  }

  return {
    updateId: nextNewUpdateId,
    content: "",
    lastSavedContent: "",
    isPublished: true,
    hasPersistedCurrentUpdate: false,
  }
}

export function BlipUpdateEditor(props: BlipUpdateEditorProps) {
  const [local] = splitProps(props, [
    "open",
    "rootBlipId",
    "editingUpdateId",
    "desktopMount",
    "focusNonce",
    "closeRequestNonce",
    "onRequestClose",
  ])
  const supabase = useSupabase()
  const { user } = useAuth() as any
  const viewport = useViewport()
  const confirm = useConfirm()
  const store = blipStore(supabase.client, { subscribe: false })

  const [currentUpdateId, setCurrentUpdateId] = createSignal<string | null>(
    blipId(),
  )
  const [content, setContent] = createSignal("")
  const [lastSavedContent, setLastSavedContent] = createSignal("")
  const [isDirty, setIsDirty] = createSignal(false)
  const [isPublished, setIsPublished] = createSignal(true)
  const [hasPersistedCurrentUpdate, setHasPersistedCurrentUpdate] =
    createSignal(false)
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>("idle")
  const [showStatus, setShowStatus] = createSignal(false)
  const [statusFading, setStatusFading] = createSignal(false)
  const [editorFocusNonce, setEditorFocusNonce] = createSignal(0)
  const [keyboardInsetPx, setKeyboardInsetPx] = createSignal(0)
  const [media, setMedia] = createSignal<MediaStore | null>(null)
  const [previewAttachment, setPreviewAttachment] =
    createSignal<Attachment | null>(null)
  const [mediaError, setMediaError] = createSignal<string | null>(null)
  // Plain ref mirror of `media()` so the lifecycle effect can tear down the
  // previous instance without reactively depending on the signal it sets.
  let mediaInstance: MediaStore | null = null

  let hideStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let fadeStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let keyboardDismissTimeout: ReturnType<typeof setTimeout> | null = null
  let lastHandledExternalFocusNonce: number | undefined
  let lastHandledCloseRequestNonce: number | undefined
  let hasOpenedAtLeastOnce = false
  let dismissKeyboardCleanupHandle: ReturnType<
    typeof clearActiveTextInputSession
  > | null = null
  const ANIMATION_MS = 260
  const isMobileViewport = createMemo(
    () => viewport.width() <= MOBILE_MAX_WIDTH,
  )

  const clearStatusTimeouts = () => {
    if (hideStatusTimeout) {
      clearTimeout(hideStatusTimeout)
      hideStatusTimeout = null
    }
    if (fadeStatusTimeout) {
      clearTimeout(fadeStatusTimeout)
      fadeStatusTimeout = null
    }
  }

  const clearKeyboardDismissTimeout = () => {
    if (keyboardDismissTimeout) {
      clearTimeout(keyboardDismissTimeout)
      keyboardDismissTimeout = null
    }
  }

  const clearDismissKeyboardCleanup = () => {
    if (dismissKeyboardCleanupHandle) {
      dismissKeyboardCleanupHandle.cancel()
      dismissKeyboardCleanupHandle = null
    }
  }

  const requestEditorFocus = () => {
    setEditorFocusNonce(previous => previous + 1)
  }
  const focusBridge = createEditorFocusBridge({
    defaultDelayMs: ANIMATION_MS,
    requestEditorFocus,
    coalesceImmediateFocus: true,
    proxyRefocusCooldownMs: 120,
    shouldAutoFocusOnOpen: () => true,
    shouldUseFocusProxy: () => true,
  })

  const handleDialogOpenAutoFocus = (event: Event) => {
    event.preventDefault()
    focusBridge.scheduleFocusAfterOpen()
  }

  const dismissKeyboard = () => {
    clearKeyboardDismissTimeout()
    clearDismissKeyboardCleanup()
    dismissKeyboardCleanupHandle = clearActiveTextInputSession(
      "updateEditor.dismissKeyboard",
    )
    if (typeof window !== "undefined") {
      keyboardDismissTimeout = setTimeout(() => {
        clearDismissKeyboardCleanup()
        dismissKeyboardCleanupHandle = clearActiveTextInputSession(
          "updateEditor.dismissKeyboard.followup",
        )
        keyboardDismissTimeout = null
      }, 80)
    }
  }

  const showStatusWithFade = () => {
    clearStatusTimeouts()
    setShowStatus(true)
    setStatusFading(false)

    fadeStatusTimeout = setTimeout(() => {
      setStatusFading(true)
    }, TIME.TWO_SECONDS)

    hideStatusTimeout = setTimeout(() => {
      setShowStatus(false)
      setStatusFading(false)
    }, TIME.FIVE_SECONDS)
  }

  const applyUpdateEditorDraft = (
    draft: ReturnType<typeof resolveUpdateEditorDraft>,
  ) => {
    debouncedDbSave.cancel()
    clearStatusTimeouts()
    setCurrentUpdateId(draft.updateId)
    setContent(draft.content)
    setLastSavedContent(draft.lastSavedContent)
    setIsDirty(false)
    setHasPersistedCurrentUpdate(draft.hasPersistedCurrentUpdate)
    setIsPublished(draft.isPublished)
    setSaveStatus("idle")
    setShowStatus(false)
    setStatusFading(false)
    focusBridge.scheduleFocusAfterOpen()
  }

  const saveToDatabase = async (
    markdown: string,
    ctx: SaveContext,
  ): Promise<boolean> => {
    try {
      setSaveStatus("saving-db")
      setShowStatus(true)
      setStatusFading(false)

      const result = await store.upsert({
        id: ctx.updateId,
        content: markdown,
        user_id: ctx.userId,
        parent_id: ctx.rootBlipId,
        blip_type: BLIP_TYPES.UPDATE,
        published: isPublished(),
        moderation_status: "approved",
      })

      if (result.error || !result.data) {
        throw new Error(result.error || "Failed to save blip update")
      }

      const persistedUpdate: Blip = {
        ...result.data,
        tags: result.data.tags ?? [],
      }

      setIsDirty(false)
      setLastSavedContent(markdown)
      setHasPersistedCurrentUpdate(true)
      setIsPublished(persistedUpdate.published)
      setSaveStatus("saved-db")
      showStatusWithFade()
      return true
    } catch (error) {
      console.error("Error saving blip update:", error)
      setSaveStatus("error")
      setShowStatus(true)
      setStatusFading(false)
      return false
    }
  }

  // eslint-disable-next-line solid/reactivity
  const debouncedDbSave = debounce(saveToDatabase, TIME.THIRTY_SECONDS)

  const saveContext = createMemo<SaveContext | null>(() => {
    const updateId = currentUpdateId()
    const rootBlipId = local.rootBlipId
    const userId = user()?.id

    if (!updateId || !rootBlipId || !userId) {
      return null
    }

    return {
      updateId,
      rootBlipId,
      userId,
    }
  })

  const selectedExistingUpdate = createMemo(() => {
    const editingId = local.editingUpdateId
    if (!editingId) {
      return null
    }

    const existing = store.getById(editingId)
    if (!existing || existing.blip_type !== BLIP_TYPES.UPDATE) {
      return null
    }

    return existing
  })
  const isEditingExistingUpdate = createMemo(() =>
    Boolean(selectedExistingUpdate()),
  )
  const editorModeLabel = createMemo(() =>
    isEditingExistingUpdate()
      ? trDetail("updates.editor.editingLabel")
      : trDetail("updates.editor.newLabel"),
  )

  createEffect(() => {
    const focusNonce = local.focusNonce
    if (focusNonce === undefined) {
      return
    }

    if (focusNonce === lastHandledExternalFocusNonce) {
      return
    }

    lastHandledExternalFocusNonce = focusNonce
    if (!local.open) {
      return
    }

    focusBridge.scheduleFocusAfterOpen()
  })

  createEffect(
    on(
      () => local.open,
      open => {
        if (!open) {
          return
        }

        hasOpenedAtLeastOnce = true
        clearKeyboardDismissTimeout()
        clearDismissKeyboardCleanup()
        setKeyboardInsetPx(0)
        focusBridge.scheduleFocusAfterOpen()
      },
    ),
  )

  useEditorMobileViewportRuntime({
    isOpen: () => local.open,
    setKeyboardInsetPx,
  })

  createEffect(
    on(
      () =>
        [
          local.open,
          local.editingUpdateId,
          local.editingUpdateId ? selectedExistingUpdate()?.id : null,
        ] as const,
      ([open, editingUpdateId, existingUpdateId]) => {
        if (!open) {
          return
        }

        applyUpdateEditorDraft(
          resolveUpdateEditorDraft({
            editingUpdateId,
            existingUpdate:
              editingUpdateId && existingUpdateId
                ? selectedExistingUpdate()
                : null,
            nextNewUpdateId: blipId(),
          }),
        )
      },
    ),
  )

  const handleEditorReady = () => {
    const updateId = currentUpdateId()
    if (!local.open || !updateId) {
      return
    }

    focusBridge.scheduleFocusAfterOpen()
  }

  createEffect(
    on(
      () => local.open,
      open => {
        if (!open) {
          setKeyboardInsetPx(0)

          if (!hasOpenedAtLeastOnce) {
            return
          }

          dismissKeyboard()
          restoreEditorDocumentInteractionState()

          debouncedDbSave.cancel()
          focusBridge.clearScheduledFocus()
          clearStatusTimeouts()

          // Desktop clears draft state in handleDesktopAfterExit after the inline
          // transition finishes. Mobile uses a dialog that unmounts immediately, so
          // reset in-memory editor state here to avoid reopening with stale content.
          if (isMobileViewport()) {
            applyUpdateEditorDraft(
              resolveUpdateEditorDraft({
                editingUpdateId: null,
                existingUpdate: null,
                nextNewUpdateId: blipId(),
              }),
            )
          }

          return
        }
      },
    ),
  )

  onCleanup(() => {
    debouncedDbSave.cancel()
    clearKeyboardDismissTimeout()
    clearDismissKeyboardCleanup()
    focusBridge.clearScheduledFocus()
    clearStatusTimeouts()
    restoreEditorDocumentInteractionState()
  })

  // Force the update's `blips` row to exist before the first `blip_media` insert
  // (FK gotcha — see mediaStore docs). The first call is a media FK stub only:
  // persist as an unpublished draft so the activity feed does not gain an empty
  // update before the author saves. Use `skipLocalCache` so the shared blips
  // singleton (also read by the detail page) is not perturbed mid-compose.
  // update before the author saves. Idempotent: mediaStore serializes
  // `onUploadSuccess`, so only the first call runs this. Reactive reads are
  // intentional point-in-time snapshots (invoked from the serialized persist
  // chain, not a tracked scope).
  // eslint-disable-next-line solid/reactivity
  const makeEnsureBlipPersisted = (id: string) => async (): Promise<boolean> => {
    if (currentUpdateId() === id && hasPersistedCurrentUpdate()) {
      return true
    }

    const userId = user()?.id
    const rootBlipId = local.rootBlipId
    if (!userId || !rootBlipId) {
      return false
    }

    const published = resolveMediaTriggeredUpdatePersistPublished(
      hasPersistedCurrentUpdate(),
      isPublished(),
    )

    const result = await store.upsert({
      id,
      user_id: userId,
      parent_id: rootBlipId,
      blip_type: BLIP_TYPES.UPDATE,
      content: content(),
      published,
      moderation_status: "approved",
    } as Partial<Blip>, { skipLocalCache: true })

    if (result.error) {
      return false
    }

    return true
  }

  // One `mediaStore` instance per edited update. Recreated when `currentUpdateId`
  // changes; the previous instance is `reset()` (tears down uploads, drops this
  // update's cached rows — the DB is left intact for saved updates).
  createEffect(
    on(currentUpdateId, (id, previousId) => {
      if (id === previousId) {
        return
      }

      if (mediaInstance) {
        mediaInstance.reset()
        mediaInstance = null
        setMedia(null)
      }

      setPreviewAttachment(null)
      setMediaError(null)

      if (!id) {
        return
      }

      const userId = user()?.id
      if (!userId) {
        return
      }

      const instance = mediaStore(supabase.client, {
        blipId: id,
        userId,
        ensureBlipPersisted: makeEnsureBlipPersisted(id),
        onMediaPersisted: () => {
          revalidate(getBlipMediaFor.key)
        },
      })
      mediaInstance = instance
      setMedia(instance)

      // Editing a saved update: hydrate its committed media. A freshly minted
      // update isn't in the store yet, so skip the (empty) round-trip.
      if (store.getById(id)) {
        void instance.fetchByBlip()
      }
    }),
  )

  onCleanup(() => {
    mediaInstance?.reset()
    mediaInstance = null
  })

  const handleMediaFiles = (files: File[]) => {
    const instance = media()
    if (!instance) {
      return
    }

    const { accepted, rejected } = validateMediaFiles(files)
    setMediaError(
      rejected.length > 0
        ? trEditor("media.invalidFiles", { count: rejected.length })
        : null,
    )

    if (accepted.length > 0) {
      void instance.attach(accepted, { source: "picker" })
    }
  }

  const handleClipboardPaste = (event: ClipboardEvent) => {
    const instance = media()
    if (!instance || !event.clipboardData) {
      return
    }

    const files = Array.from(event.clipboardData.files ?? [])
    const images = files.filter(file => file.type.startsWith("image/"))
    if (images.length === 0) {
      // No image payload — let ProseMirror handle text/HTML paste normally.
      return
    }

    event.preventDefault()
    const { accepted, rejected } = validateMediaFiles(images)
    setMediaError(
      rejected.length > 0
        ? trEditor("media.invalidFiles", { count: rejected.length })
        : null,
    )
    if (accepted.length > 0) {
      void instance.attach(accepted, { source: "clipboard" })
    }
  }

  const handleComposerDrop = (event: DragEvent) => {
    const instance = media()
    if (!instance || !event.dataTransfer) {
      return
    }

    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length === 0) {
      return
    }

    event.preventDefault()
    handleMediaFiles(files)
  }

  const handleComposerDragOver = (event: DragEvent) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault()
    }
  }

  const scheduleAutoSave = (markdown: string) => {
    if (
      !local.open ||
      markdown.trim().length === 0 ||
      markdown === lastSavedContent()
    ) {
      debouncedDbSave.cancel()
      return
    }

    const ctx = saveContext()
    if (!ctx) {
      debouncedDbSave.cancel()
      return
    }

    debouncedDbSave(markdown, ctx)
  }

  const handleContentChange = (markdown: string) => {
    setContent(markdown)
    setIsDirty(markdown !== lastSavedContent())
    setSaveStatus("idle")
    scheduleAutoSave(markdown)
  }

  const hasPendingChanges = createMemo(
    () => isDirty() && content().trim().length > 0 && local.open,
  )

  const hasReadyMedia = createMemo(() => {
    const instance = media()
    if (!instance) {
      return false
    }

    return instance.hasMedia() && instance.canPublish()
  })

  const hasComposeDraft = createMemo(() =>
    resolveUpdateHasComposeDraft({
      hasText: content().trim().length > 0,
      hasMedia: Boolean(media()?.hasMedia()),
    }),
  )

  const canSave = createMemo(() =>
    resolveUpdateCanSave({
      open: local.open,
      hasSaveContext: Boolean(saveContext()),
      hasPendingTextChanges: hasPendingChanges(),
      hasReadyMedia: hasReadyMedia(),
      hasPersistedCurrentUpdate: hasPersistedCurrentUpdate(),
    }),
  )

  const handleSave = async (closeAfterSave = false) => {
    const ctx = saveContext()
    if (!canSave()) {
      return
    }
    if (!ctx) {
      return
    }

    debouncedDbSave.cancel()
    const wasSaved = await saveToDatabase(content(), ctx)
    if (wasSaved && closeAfterSave) {
      local.onRequestClose?.()
    }
  }

  const canDelete = createMemo(() => {
    if (!local.open || !currentUpdateId()) {
      return false
    }

    if (hasPersistedCurrentUpdate()) {
      return true
    }

    return hasComposeDraft()
  })

  const handleDelete = () => {
    const updateId = currentUpdateId()
    const persisted = hasPersistedCurrentUpdate()

    if (!updateId || !canDelete()) {
      return
    }

    confirm({
      title: trDetail("updates.confirmDelete.title"),
      prompt: trDetail(
        persisted
          ? "updates.confirmDelete.persistedPrompt"
          : "updates.confirmDelete.unsavedPrompt",
      ),
      variant: "destructive",
      confirmationActionLabel: trDetail(
        "updates.confirmDelete.actions.confirm",
      ),
      confirmationActionLoadingLabel: trDetail(
        "updates.confirmDelete.actions.confirming",
      ),
      cancelActionLabel: trDetail("updates.confirmDelete.actions.cancel"),
      onConfirm: async () => {
        const closeAfterDelete = () => {
          debouncedDbSave.cancel()
          local.onRequestClose?.()
        }

        if (!persisted) {
          closeAfterDelete()
          return
        }

        try {
          debouncedDbSave.cancel()
          const result = await store.remove(updateId)
          if (result.error) {
            throw new Error(result.error)
          }
          closeAfterDelete()
        } catch (error) {
          console.error("Error deleting blip update:", error)
          setSaveStatus("error")
          setShowStatus(true)
          setStatusFading(false)
        }
      },
    })
  }

  const handleTogglePublish = async () => {
    const ctx = saveContext()
    if (!ctx || !hasPersistedCurrentUpdate() || hasPendingChanges()) {
      return
    }

    try {
      setSaveStatus("saving-db")
      setShowStatus(true)
      setStatusFading(false)

      const nextPublished = !isPublished()
      const result = await store.upsert({
        id: ctx.updateId,
        user_id: ctx.userId,
        parent_id: ctx.rootBlipId,
        blip_type: BLIP_TYPES.UPDATE,
        content: content(),
        published: nextPublished,
        moderation_status: "approved",
      })

      if (result.error || !result.data) {
        throw new Error(
          result.error || "Failed to toggle update published state",
        )
      }

      const persistedUpdate: Blip = {
        ...result.data,
        tags: result.data.tags ?? [],
      }

      setHasPersistedCurrentUpdate(true)
      setIsPublished(persistedUpdate.published)
      setSaveStatus("saved-db")
      showStatusWithFade()
    } catch (error) {
      console.error("Error toggling update publish state:", error)
      setSaveStatus("error")
      setShowStatus(true)
      setStatusFading(false)
    }
  }

  const hasCloseDraftContent = createMemo(() => {
    const hasUnsavedEdits = hasPendingChanges()
    const hasUnpublishedPersistedUpdate =
      hasPersistedCurrentUpdate() && !isPublished()
    const hasUnpersistedDraft =
      hasComposeDraft() && !hasPersistedCurrentUpdate()

    return (
      hasUnsavedEdits || hasUnpublishedPersistedUpdate || hasUnpersistedDraft
    )
  })

  const closeAndDiscardDraft = async () => {
    debouncedDbSave.cancel()

    const updateId = currentUpdateId()
    if (updateId && (hasPersistedCurrentUpdate() || media()?.hasMedia())) {
      const result = await store.remove(updateId)
      if (result.error) {
        throw new Error(result.error)
      }
    }

    mediaInstance?.reset()

    dismissKeyboard()
    local.onRequestClose?.()
  }

  const handleClose = () => {
    if (!hasCloseDraftContent()) {
      dismissKeyboard()
      local.onRequestClose?.()
      return
    }

    confirm({
      title: trDetail("updates.confirmCloseDraft.title"),
      prompt: trDetail("updates.confirmCloseDraft.prompt"),
      variant: "destructive",
      confirmationActionLabel: trDetail(
        "updates.confirmCloseDraft.actions.close",
      ),
      confirmationActionLoadingLabel: trDetail(
        "updates.confirmCloseDraft.actions.closing",
      ),
      cancelActionLabel: trDetail("updates.confirmCloseDraft.actions.cancel"),
      onConfirm: async () => {
        try {
          await closeAndDiscardDraft()
        } catch (error) {
          console.error("Error discarding blip update draft:", error)
          setSaveStatus("error")
          setShowStatus(true)
          setStatusFading(false)
        }
      },
    })
  }

  const handleDesktopAfterExit = () => {
    applyUpdateEditorDraft(
      resolveUpdateEditorDraft({
        editingUpdateId: null,
        existingUpdate: null,
        nextNewUpdateId: blipId(),
      }),
    )
  }

  createEffect(() => {
    const closeRequestNonce = local.closeRequestNonce
    if (closeRequestNonce === undefined) {
      return
    }

    if (closeRequestNonce === lastHandledCloseRequestNonce) {
      return
    }

    lastHandledCloseRequestNonce = closeRequestNonce
    if (!local.open) {
      return
    }

    handleClose()
  })

  const getStatusIcon = () => {
    const status = saveStatus()

    if (status === "saving-db") {
      return <LoadingSpinner class="blip-editor-status-spinner" />
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

  const preventEditorBlur = (event: MouseEvent) => {
    event.preventDefault()
  }

  const EditorControls = (ctx: MarkdownEditorControlsProps) => {
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
                  aria-label={trEditor("actions.close")}
                  onClick={handleClose}
                  onMouseDown={preventEditorBlur}
                />
                <MediaButton
                  onFiles={handleMediaFiles}
                  onMouseDown={preventEditorBlur}
                  label={trEditor("media.trigger")}
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
                  aria-label={trEditor("actions.toggleToolbar")}
                  onClick={() => ctx.onToggleToolbar()}
                  onMouseDown={preventEditorBlur}>
                  <Icon name="format_bold" />
                  <Icon name="format_italic" />
                  <Icon name="format_underlined" />
                </button>
                <div class="blip-editor-control-divider" />
                <IconButton
                  size="xs"
                  icon="delete"
                  class="blip-action-delete"
                  aria-label={trDetail("updates.actions.delete")}
                  disabled={!ctx.statusContext?.canDelete}
                  onClick={ctx.statusContext?.handleDelete}
                  onMouseDown={preventEditorBlur}
                />
                <IconButton
                  size="xs"
                  icon={
                    ctx.statusContext?.isPublished
                      ? "check_circle"
                      : "arrow_upload_ready"
                  }
                  disabled={!ctx.statusContext?.canTogglePublish}
                  onClick={ctx.statusContext?.handleTogglePublish}
                  class={cx("blip-action-publish", {
                    published: ctx.statusContext?.isPublished,
                    unpublished: !ctx.statusContext?.isPublished,
                  })}
                  aria-label={
                    ctx.statusContext?.isPublished
                      ? trEditor("actions.unpublish")
                      : trEditor("actions.publish")
                  }
                  onMouseDown={preventEditorBlur}
                />
                <IconButton
                  size="xs"
                  icon="cloud_upload"
                  class="blip-action-save"
                  aria-label={trEditor("actions.save")}
                  disabled={!ctx.statusContext?.canSave}
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

  const UpdateEditorSurface = (props: {
    updateId: string
    useDialogTitle?: boolean
  }) => {
    const showDesktopHeader = !isMobileViewport()

    return (
      <EditorShell
        shellClass="blip-update-editor-surface"
        bodyClass="blip-update-editor-body"
        focusProxyRef={focusBridge.setFocusProxyRef}
        focusProxyAriaLabel={trDetail("updates.placeholder")}
        icon={isMobileViewport() ? undefined : "chat"}
        showFocusProxy={false}
        Header={
          props.useDialogTitle ? (
            <DialogTitle class="blip-update-editor-dialog-title">
              {editorModeLabel()}
            </DialogTitle>
          ) : showDesktopHeader ? (
            <div class="blip-update-editor-top-row">
              <div class="blip-update-editor-mode-label">
                {editorModeLabel()}
              </div>
            </div>
          ) : undefined
        }
      >
        <form
          class="blip-editor-form blip-update-editor-form"
          onPaste={handleClipboardPaste}
          onDrop={handleComposerDrop}
          onDragOver={handleComposerDragOver}
          onSubmit={event => {
            event.preventDefault()
            void handleSave(true)
          }}>
          <MarkdownEditor
            instanceKey={`blip-update-editor:${props.updateId}`}
            focusNonce={editorFocusNonce()}
            focusCaretPlacement="end"
            placeholder={trDetail("updates.placeholder")}
            initialValue={content()}
            onChange={handleContentChange}
            onEditorReady={handleEditorReady}
            AboveControls={ComposerMediaChrome}
            aboveControlsProps={{
              media,
              mediaError,
              onPreview: setPreviewAttachment,
            }}
            EditorControls={EditorControls}
            statusIcon={getStatusIcon()}
            showStatus={showStatus()}
            statusFading={statusFading()}
            showStatusBar={false}
            statusContext={{
              canDelete: canDelete(),
              canTogglePublish:
                hasPersistedCurrentUpdate() && !hasPendingChanges(),
              canSave: canSave(),
              isPublished: isPublished(),
              handleDelete,
              handleTogglePublish: () => {
                void handleTogglePublish()
              },
              handleSave: () => {
                void handleSave(true)
              },
            }}
          />
          <ComposerPreviewModal
            attachment={previewAttachment()}
            onClose={() => setPreviewAttachment(null)}
            closeLabel={trEditor("media.closePreview")}
          />
        </form>
      </EditorShell>
    )
  }

  return (
    <>
      <Show when={local.open}>
        <textarea
          ref={focusBridge.setFocusProxyRef}
          class="blip-editor-focus-proxy"
          tabIndex={-1}
          aria-label={trDetail("updates.placeholder")}
        />
      </Show>
      <Show
        when={isMobileViewport()}
        fallback={
          <PortaledInlineTransition
            mount={local.desktopMount}
            open={local.open}
            class="blip-update-editor-layer"
            onAfterExit={handleDesktopAfterExit}>
            <UpdateEditorSurface updateId={currentUpdateId() ?? blipId()} />
          </PortaledInlineTransition>
        }>
        <Show
          when={local.open ? currentUpdateId() : null}
          keyed>
          {updateId => (
            <Dialog
              open={local.open}
              onOpenChange={open => {
                if (!open) {
                  handleClose()
                }
              }}
              modal
              preventScroll
              overlayClass="blip-update-editor-overlay"
              class="blip-update-editor-dialog"
              style={{ "--blip-keyboard-inset": `${keyboardInsetPx()}px` }}
              contentProps={{
                onOpenAutoFocus: handleDialogOpenAutoFocus,
                onCloseAutoFocus: event => event.preventDefault(),
              }}>
              <div class="blip-update-editor-dialog-frame">
                <UpdateEditorSurface
                  updateId={updateId}
                  useDialogTitle
                />
              </div>
            </Dialog>
          )}
        </Show>
      </Show>
    </>
  )
}
