import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
  splitProps,
} from "solid-js"
import { MarkdownEditor } from "@/components/markdown/editor"
import { Icon, LoadingSpinner } from "@/components/icon"
import { Button } from "@/components/button"
import { IconButton } from "@/components/icon-button"
import { useConfirm } from "@/components/confirm-dialog"
import { ptr } from "@/i18n"
import { debounce } from "@/util/debounce"
import { TIME } from "@/util/enums"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import { BLIP_TYPES, blipId, blipStore, type Blip } from "@/modules/blips/data"
import "./blip-update-editor.css"

type BlipUpdateEditorProps = {
  open: boolean
  rootBlipId?: string | null
  editingUpdateId?: string | null
  focusNonce?: number
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

export function BlipUpdateEditor(props: BlipUpdateEditorProps) {
  const [local] = splitProps(props, [
    "open",
    "rootBlipId",
    "editingUpdateId",
    "focusNonce",
    "onRequestClose",
  ])
  const supabase = useSupabase()
  const { user } = useAuth() as any
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
  const [isEditorOpen, setIsEditorOpen] = createSignal(false)
  const [skipClosePersist, setSkipClosePersist] = createSignal(false)

  let hideStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let fadeStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let focusAfterOpenTimeout: ReturnType<typeof setTimeout> | null = null
  let keyboardDismissTimeout: ReturnType<typeof setTimeout> | null = null
  let closeAnimationTimeout: ReturnType<typeof setTimeout> | null = null
  let openAnimationFrameId: number | null = null
  let lastHandledExternalFocusNonce: number | undefined
  let hasOpenedAtLeastOnce = false
  const ANIMATION_MS = 260

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

  const clearFocusAfterOpenTimeout = () => {
    if (focusAfterOpenTimeout) {
      clearTimeout(focusAfterOpenTimeout)
      focusAfterOpenTimeout = null
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

  const getKeyboardInsetPx = () => {
    if (typeof window === "undefined") {
      return 0
    }

    const viewport = window.visualViewport
    if (!viewport) {
      return 0
    }

    return Math.max(
      0,
      Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)),
    )
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

  const resetForNewUpdate = (focusEditor = false) => {
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

    if (focusEditor) {
      requestEditorFocus()
    }
  }

  const loadExistingUpdate = (update: Blip, focusEditor = false) => {
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

    if (focusEditor) {
      requestEditorFocus()
    }
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

    const existing = store.entities().find(blip => blip.id === editingId)
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

    requestEditorFocus()
    clearFocusAfterOpenTimeout()
    focusAfterOpenTimeout = setTimeout(() => {
      requestEditorFocus()
      focusAfterOpenTimeout = null
    }, ANIMATION_MS)
  })

  createEffect(() => {
    if (local.open) {
      hasOpenedAtLeastOnce = true
      clearCloseAnimationTimeout()
      clearOpenAnimationFrame()
      setSkipClosePersist(false)
      setIsEditorOpen(false)

      const existing = selectedExistingUpdate()
      if (existing) {
        if (currentUpdateId() !== existing.id) {
          loadExistingUpdate(existing, true)
        }
      } else if (!currentUpdateId()) {
        resetForNewUpdate(true)
      }

      if (typeof window !== "undefined") {
        openAnimationFrameId = window.requestAnimationFrame(() => {
          setIsEditorOpen(true)
          requestEditorFocus()
          clearFocusAfterOpenTimeout()
          focusAfterOpenTimeout = setTimeout(() => {
            requestEditorFocus()
            focusAfterOpenTimeout = null
          }, ANIMATION_MS)
          openAnimationFrameId = null
        })
      } else {
        setIsEditorOpen(true)
        requestEditorFocus()
      }
    }
  })

  createEffect(() => {
    if (!local.open) {
      setKeyboardInsetPx(0)
      return
    }

    if (typeof window === "undefined") {
      return
    }

    const updateInset = () => {
      setKeyboardInsetPx(getKeyboardInsetPx())
    }

    updateInset()
    const viewport = window.visualViewport
    viewport?.addEventListener("resize", updateInset)
    viewport?.addEventListener("scroll", updateInset)

    onCleanup(() => {
      viewport?.removeEventListener("resize", updateInset)
      viewport?.removeEventListener("scroll", updateInset)
    })
  })

  createEffect(() => {
    if (!local.open || typeof window === "undefined" || typeof document === "undefined") {
      return
    }

    if (!window.matchMedia("(max-width: 48rem)").matches) {
      return
    }

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow

    html.style.overflow = "hidden"
    body.style.overflow = "hidden"

    onCleanup(() => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
    })
  })

  createEffect(() => {
    if (local.open || !hasOpenedAtLeastOnce) {
      return
    }

    dismissKeyboard()

    debouncedDbSave.cancel()
    clearFocusAfterOpenTimeout()
    clearStatusTimeouts()
    setIsEditorOpen(false)

    clearCloseAnimationTimeout()
    // Dispose composer state immediately on close so reopen is always fresh.
    setCurrentUpdateId(blipId())
    setContent("")
    setIsDirty(false)
    setIsPublished(true)
    setHasPersistedCurrentUpdate(false)
    setSaveStatus("idle")
    setShowStatus(false)
    setStatusFading(false)
    setSkipClosePersist(false)
  })

  onCleanup(() => {
    debouncedDbSave.cancel()
    clearKeyboardDismissTimeout()
    clearFocusAfterOpenTimeout()
    clearStatusTimeouts()
    clearCloseAnimationTimeout()
    clearOpenAnimationFrame()
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

  const getStatusText = () => {
    const status = saveStatus()

    switch (status) {
      case "saving-db":
        return trEditor("status.saving")
      case "saved-db":
        return trEditor("status.saved")
      case "error":
        return trEditor("status.error")
      default:
        return ""
    }
  }

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

  const StatusBarActions = (ctx: StatusContext) => (
    <div class="blip-update-editor-actions">
      <IconButton
        size="xs"
        icon="delete"
        class="blip-update-editor-delete"
        aria-label={trDetail("updates.actions.delete")}
        disabled={!ctx.canDelete}
        onClick={ctx.handleDelete}
        onMouseDown={event => event.preventDefault()}
      />
      <IconButton
        size="xs"
        icon={ctx.isPublished ? "check_circle" : "arrow_upload_ready"}
        class={`blip-update-editor-publish ${ctx.isPublished ? "published" : "unpublished"}`}
        aria-label={
          ctx.isPublished
            ? trEditor("actions.unpublish")
            : trEditor("actions.publish")
        }
        disabled={!ctx.canTogglePublish}
        onClick={ctx.handleTogglePublish}
        onMouseDown={event => event.preventDefault()}
      />
      <Button
        variant="ghost"
        size="xs"
        icon="cloud_upload"
        label={trEditor("actions.save")}
        class="blip-update-editor-save"
        aria-label={trEditor("actions.save")}
        disabled={!ctx.canSave}
        onClick={ctx.handleSave}
        onMouseDown={event => event.preventDefault()}
      />
    </div>
  )

  return (
    <Show
      when={currentUpdateId()}
      keyed>
      {updateId => (
        <div
          class="blip-update-editor-layer"
          classList={{ "is-open": isEditorOpen() }}
          style={{ "--blip-keyboard-inset": `${keyboardInsetPx()}px` }}>
          <button
            type="button"
            class="blip-update-editor-backdrop"
            aria-label={trEditor("actions.close")}
            onClick={handleClose}
          />
          <div
            class="blip-update-editor-shell"
            classList={{ "is-open": isEditorOpen() }}>
            <div class="blip-update-editor-shell-inner">
              <div class="blip-update-editor-top-row">
                <div class="blip-update-editor-mode-label">
                  {editorModeLabel()}
                </div>
                <IconButton
                  size="xs"
                  icon="close"
                  class="blip-update-editor-close"
                  aria-label={trEditor("actions.close")}
                  onClick={handleClose}
                  onMouseDown={event => event.preventDefault()}
                />
              </div>
              <div class="blip-update-editor-body">
                <form
                  class="blip-update-editor"
                  onSubmit={event => {
                    event.preventDefault()
                    void handleSave(true)
                  }}>
                  <MarkdownEditor
                    instanceKey={`blip-update-editor:${updateId}`}
                    focusNonce={editorFocusNonce()}
                    placeholder={trDetail("updates.placeholder")}
                    initialValue={content()}
                    onChange={handleContentChange}
                    statusText={getStatusText()}
                    statusIcon={getStatusIcon()}
                    showStatus={showStatus()}
                    statusFading={statusFading()}
                    statusActions={StatusBarActions}
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
                    showStatusBar
                  />
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  )
}
