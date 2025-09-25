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
import { withWindow } from "@/util/browser"
import { clsx as cx } from "@/util"
import { ptr } from "@/i18n"
import { debounce } from "@/util/debounce"
import { TIME } from "@/util/enums"
import { useSupabase } from "@/context/services-context"
import { useAuth } from "@/context/auth-context"
import type { Blip } from "@/modules/blips/data/schema"
import { blipId, blipStore } from "@/modules/blips/data"
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

  // Local state
  const [currentBlipId, setCurrentBlipId] = createSignal<string | null>(null)
  const [content, setContent] = createSignal<string>("")
  const [lastCachedContent, setLastCachedContent] = createSignal<string>("")
  const [lastDbSavedContent, setLastDbSavedContent] = createSignal<string>("")
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>("idle")
  const [showStatus, setShowStatus] = createSignal<boolean>(false)
  const [statusFading, setStatusFading] = createSignal<boolean>(false)
  const [editorView, setEditorView] = createSignal<EditorView>("editor")

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

  const clearEditorFocusTimeout = () => {
    if (editorFocusTimeout) {
      clearTimeout(editorFocusTimeout)
      editorFocusTimeout = null
    }
  }

  const focusEditorInput = (attempt = 0) => {
    withWindow(() => {
      const editorInput = document.querySelector(
        '.blip-editor-container .ProseMirror[contenteditable="true"]',
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
    setSaveStatus("idle")
    setEditorView("editor")
  }

  const openExistingBlip = (selectedBlip: Blip, assumePersisted = false) => {
    const selectedContent = selectedBlip.content || ""
    setCurrentBlipId(selectedBlip.id)
    setContent(selectedContent)
    setLastCachedContent(selectedContent)
    setLastDbSavedContent(assumePersisted ? selectedContent : "")
    setSaveStatus("idle")
    setEditorView("editor")
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
      })

      if (result.error) {
        throw new Error(result.error)
      }

      setLastDbSavedContent(markdown)
      setLastCachedContent(markdown)
      setSaveStatus("saved-db")
      showStatusWithFade()
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

  // Initialize editor state when drawer opens
  createEffect(() => {
    if (local.open && !currentBlipId()) {
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
    if (!local.open) {
      clearEditorFocusTimeout()

      const closingBlipId = currentBlipId()
      const closingContent = content()
      const cachedContent = lastCachedContent()
      const dbSavedContent = lastDbSavedContent()
      const userId = user()?.id

      // Cancel any pending saves
      debouncedCacheSave.cancel()
      debouncedDbSave.cancel()

      // If there are unsaved changes when closing, persist them immediately.
      // This prevents losing drafts when users close quickly and refresh.
      const hasBlipId = !!closingBlipId
      const hasContent = closingContent.trim().length > 0
      const needsCacheSave = closingContent !== cachedContent
      const needsDbSave = closingContent !== dbSavedContent

      if (hasBlipId && hasContent && needsCacheSave) {
        void store.upsert(
          {
            id: closingBlipId!,
            content: closingContent,
            ...(userId ? { user_id: userId } : {}),
          },
          { cacheOnly: true },
        )
      }

      if (hasBlipId && hasContent && needsDbSave && userId) {
        void store.upsert({
          id: closingBlipId!,
          content: closingContent,
          user_id: userId,
        })
      }

      // Clear timeouts
      if (hideStatusTimeout) {
        clearTimeout(hideStatusTimeout)
      }
      if (fadeStatusTimeout) {
        clearTimeout(fadeStatusTimeout)
      }

      // Small delay to allow drawer animation to complete
      setTimeout(() => {
        setCurrentBlipId(null)
        setContent("")
        setLastCachedContent("")
        setLastDbSavedContent("")
        setSaveStatus("idle")
        setEditorView("editor")
        setShowStatus(false)
        setStatusFading(false)
      }, TIME.HALF_SECOND)
    }
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
    clearEditorFocusTimeout()
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
          local.close()
        } catch (error) {
          console.error("Error deleting blip:", error)
          setSaveStatus("error")
          setShowStatus(true)
        }
      },
    })
  }

  const hasPendingChanges = () => content() !== lastCachedContent()

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
    local.onPanelOpenChange(!open)
  }

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

  return (
    <Drawer
      side="bottom"
      open={local.open}
      onOpenChange={handleOpenChange}
      class="blip-editor-container"
      showTrigger={false}
      showClose={false}
      drawerProps={{ closeOnOutsideFocus: false }}>
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
                  statusText={getStatusText()}
                  statusIcon={getStatusIcon()}
                  showStatus={showStatus()}
                  statusFading={statusFading()}
                  statusActions={StatusBarActions}
                  statusContext={{
                    isPublished: isPublished(),
                    hasBlipId: !!currentBlipId(),
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
