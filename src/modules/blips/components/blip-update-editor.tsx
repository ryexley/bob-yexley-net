import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Show,
  splitProps,
} from "solid-js"
import { Portal } from "solid-js/web"
import {
  MarkdownEditor,
  type MarkdownEditorBelowEditorProps,
} from "@/components/markdown/editor"
import { Icon, LoadingSpinner } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { useConfirm } from "@/components/confirm-dialog"
import { Dialog, DialogTitle } from "@/components/dialog"
import { restoreEditorDocumentInteractionState } from "@/modules/blips/components/editor-document-recovery"
import { createEditorFocusBridge } from "@/modules/blips/components/editor-focus-bridge"
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
type StatusContext = {
  canDelete: boolean
  canTogglePublish: boolean
  canSave: boolean
  isPublished: boolean
  handleDelete: () => void
  handleTogglePublish: () => void
  handleSave: () => void
}

const trDetail = ptr("blips.views.detail")
const trEditor = ptr("blips.components.blipEditor")
const MOBILE_MAX_WIDTH = 768

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
  const [isDirty, setIsDirty] = createSignal(false)
  const [isPublished, setIsPublished] = createSignal(true)
  const [hasPersistedCurrentUpdate, setHasPersistedCurrentUpdate] =
    createSignal(false)
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>("idle")
  const [showStatus, setShowStatus] = createSignal(false)
  const [statusFading, setStatusFading] = createSignal(false)
  const [editorFocusNonce, setEditorFocusNonce] = createSignal(0)
  const [keyboardInsetPx, setKeyboardInsetPx] = createSignal(0)
  const [isEditorMounted, setIsEditorMounted] = createSignal(local.open)
  const [isEditorOpen, setIsEditorOpen] = createSignal(false)
  const [skipClosePersist, setSkipClosePersist] = createSignal(false)

  let hideStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let fadeStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let keyboardDismissTimeout: ReturnType<typeof setTimeout> | null = null
  let closeAnimationTimeout: ReturnType<typeof setTimeout> | null = null
  let openAnimationFrameId: number | null = null
  let lastHandledExternalFocusNonce: number | undefined
  let lastHandledCloseRequestNonce: number | undefined
  let hasOpenedAtLeastOnce = false
  const ANIMATION_MS = 260
  const isMobileViewport = createMemo(() => viewport.width() <= MOBILE_MAX_WIDTH)

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

  const clearCloseAnimationTimeout = () => {
    if (closeAnimationTimeout) {
      clearTimeout(closeAnimationTimeout)
      closeAnimationTimeout = null
    }
  }

  const clearKeyboardDismissTimeout = () => {
    if (keyboardDismissTimeout) {
      clearTimeout(keyboardDismissTimeout)
      keyboardDismissTimeout = null
    }
  }

  const clearOpenAnimationFrame = () => {
    if (openAnimationFrameId !== null) {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(openAnimationFrameId)
      }
      openAnimationFrameId = null
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
  })

  const handleDialogOpenAutoFocus = (event: Event) => {
    event.preventDefault()
    focusBridge.scheduleFocusAfterOpen()
  }

  const dismissKeyboard = () => {
    if (typeof document === "undefined") {
      return
    }

    const blurActiveElement = () => {
      const activeElement = document.activeElement as
        | (HTMLElement & { blur?: () => void })
        | null
      if (activeElement?.blur) {
        activeElement.blur()
      }
    }

    blurActiveElement()
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        blurActiveElement()
      })
      clearKeyboardDismissTimeout()
      keyboardDismissTimeout = setTimeout(() => {
        blurActiveElement()
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

  const resetForNewUpdate = () => {
    debouncedDbSave.cancel()
    clearStatusTimeouts()
    setCurrentUpdateId(blipId())
    setContent("")
    setIsDirty(false)
    setHasPersistedCurrentUpdate(false)
    setIsPublished(true)
    setSaveStatus("idle")
    setShowStatus(false)
    setStatusFading(false)
  }

  const loadExistingUpdate = (update: Blip) => {
    debouncedDbSave.cancel()
    clearStatusTimeouts()
    setCurrentUpdateId(update.id)
    setContent(update.content ?? "")
    setIsDirty(false)
    setHasPersistedCurrentUpdate(true)
    setIsPublished(update.published)
    setSaveStatus("idle")
    setShowStatus(false)
    setStatusFading(false)
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
      setIsEditorMounted(true)
      clearKeyboardDismissTimeout()
      clearCloseAnimationTimeout()
      clearOpenAnimationFrame()
      setSkipClosePersist(false)
      setIsEditorOpen(false)

        if (!isMobileViewport()) {
          focusBridge.scheduleFocusAfterOpen()
        }

      if (typeof window !== "undefined") {
        openAnimationFrameId = window.requestAnimationFrame(() => {
          setIsEditorOpen(true)
          openAnimationFrameId = null
        })
      } else {
        setIsEditorOpen(true)
      }
      },
    ),
  )

  useEditorMobileViewportRuntime({
    isOpen: () => local.open,
    setKeyboardInsetPx,
  })

  createEffect(
    on(
      () => [local.open, local.editingUpdateId, selectedExistingUpdate()] as const,
      ([open, editingUpdateId, existing]) => {
        if (!open) {
          return
        }

        if (editingUpdateId) {
          if (existing && currentUpdateId() !== existing.id) {
            loadExistingUpdate(existing)
          }
          return
        }

        if (!currentUpdateId()) {
          resetForNewUpdate()
        }
      },
    ),
  )

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
          setIsEditorOpen(false)

          clearCloseAnimationTimeout()
          closeAnimationTimeout = setTimeout(() => {
            // Dispose composer state after the close animation so the shell can
            // animate out smoothly without its content disappearing mid-transition.
            setIsEditorMounted(false)
            setCurrentUpdateId(blipId())
            setContent("")
            setIsDirty(false)
            setIsPublished(true)
            setHasPersistedCurrentUpdate(false)
            setSaveStatus("idle")
            setShowStatus(false)
            setStatusFading(false)
            setSkipClosePersist(false)
            closeAnimationTimeout = null
          }, ANIMATION_MS)

          return
        }

      },
    ),
  )

  onCleanup(() => {
    debouncedDbSave.cancel()
    clearKeyboardDismissTimeout()
    focusBridge.clearScheduledFocus()
    clearStatusTimeouts()
    clearCloseAnimationTimeout()
    clearOpenAnimationFrame()
    restoreEditorDocumentInteractionState()
  })

  const handleContentChange = (markdown: string) => {
    setContent(markdown)
    setIsDirty(markdown.trim().length > 0)
    setSaveStatus("idle")
  }

  const hasPendingChanges = createMemo(
    () => isDirty() && content().trim().length > 0 && local.open,
  )

  createEffect(() => {
    if (!local.open) {
      debouncedDbSave.cancel()
      return
    }

    const markdown = content()
    const ctx = saveContext()
    const pendingChanges = isDirty() && markdown.trim().length > 0

    if (!pendingChanges || !ctx) {
      debouncedDbSave.cancel()
      return
    }

    debouncedDbSave(markdown, ctx)
  })

  const handleSave = async (closeAfterSave = false) => {
    const ctx = saveContext()
    if (!hasPendingChanges()) {
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

    return content().trim().length > 0
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
          setSkipClosePersist(true)
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
    const hasAnyContent = content().trim().length > 0
    const hasUnsavedEdits = hasPendingChanges()
    const hasUnpublishedPersistedUpdate =
      hasPersistedCurrentUpdate() && !isPublished()
    const hasUnpersistedDraft = hasAnyContent && !hasPersistedCurrentUpdate()

    return (
      hasUnsavedEdits || hasUnpublishedPersistedUpdate || hasUnpersistedDraft
    )
  })

  const closeAndDiscardDraft = async () => {
    debouncedDbSave.cancel()
    setSkipClosePersist(true)

    if (hasPersistedCurrentUpdate()) {
      const updateId = currentUpdateId()
      if (updateId) {
        const result = await store.remove(updateId)
        if (result.error) {
          throw new Error(result.error)
        }
      }
    }

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
          setSkipClosePersist(false)
          setSaveStatus("error")
          setShowStatus(true)
          setStatusFading(false)
        }
      },
    })
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
      return <LoadingSpinner size="0.75rem" />
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

  const EditorControls = (ctx: MarkdownEditorBelowEditorProps) => {
    const statusContext = ctx.statusContext as StatusContext | undefined

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
                  disabled={!statusContext?.canDelete}
                  onClick={statusContext?.handleDelete}
                  onMouseDown={preventEditorBlur}
                />
                <IconButton
                  size="xs"
                  icon={
                    statusContext?.isPublished
                      ? "check_circle"
                      : "arrow_upload_ready"
                  }
                  disabled={!statusContext?.canTogglePublish}
                  onClick={statusContext?.handleTogglePublish}
                  class={cx("blip-action-publish", {
                    published: statusContext?.isPublished,
                    unpublished: !statusContext?.isPublished,
                  })}
                  aria-label={
                    statusContext?.isPublished
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
                  disabled={!statusContext?.canSave}
                  onClick={statusContext?.handleSave}
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
    isOpen: boolean
  }) => {
    const showDesktopHeader = !isMobileViewport()

    return (
    <EditorShell
      transitionClass="blip-update-editor-shell"
      shellClass="blip-update-editor-surface"
      bodyClass="blip-update-editor-body"
      focusProxyRef={focusBridge.setFocusProxyRef}
      focusProxyAriaLabel={trDetail("updates.placeholder")}
      showHandle={!showDesktopHeader}
      Header={
        props.useDialogTitle ? (
          <DialogTitle class="blip-update-editor-dialog-title">
            {editorModeLabel()}
          </DialogTitle>
        ) : showDesktopHeader ? (
          <div class="blip-update-editor-top-row">
            <div class="blip-update-editor-mode-label">{editorModeLabel()}</div>
          </div>
        ) : undefined
      }
      isOpen={props.isOpen}>
      <form
        class="blip-editor-form blip-update-editor-form"
        onSubmit={event => {
          event.preventDefault()
          void handleSave(true)
        }}>
        <MarkdownEditor
          instanceKey={`blip-update-editor:${props.updateId}`}
          focusNonce={editorFocusNonce()}
          placeholder={trDetail("updates.placeholder")}
          initialValue={content()}
          onChange={handleContentChange}
          BelowEditor={EditorControls}
          statusIcon={getStatusIcon()}
          showStatus={showStatus()}
          statusFading={statusFading()}
          showStatusBar={false}
          statusContext={{
            canDelete: canDelete(),
            canTogglePublish:
              hasPersistedCurrentUpdate() && !hasPendingChanges(),
            canSave: hasPendingChanges() && Boolean(saveContext()),
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
      </form>
    </EditorShell>
    )
  }

  return (
    <Show
      when={isEditorMounted() ? currentUpdateId() : null}
      keyed>
      {updateId => (
        <Show
          when={isMobileViewport()}
          fallback={
            local.desktopMount ? (
              <Portal mount={local.desktopMount}>
                <div class="blip-update-editor-layer">
                  <UpdateEditorSurface
                    updateId={updateId}
                    isOpen={isEditorOpen()}
                  />
                </div>
              </Portal>
            ) : null
          }>
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
                isOpen
              />
            </div>
          </Dialog>
        </Show>
      )}
    </Show>
  )
}
