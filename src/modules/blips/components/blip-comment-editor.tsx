import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"
import {
  MarkdownEditor,
  type MarkdownEditorBelowEditorProps,
} from "@/components/markdown/editor"
import { Icon, LoadingSpinner } from "@/components/icon"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@/components/dialog"
import { IconButton } from "@/components/icon-button"
import { useConfirm } from "@/components/confirm-dialog"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { useViewport } from "@/context/viewport"
import { EditorShell } from "@/modules/blips/components/editor-shell"
import { UserAvatar } from "@/modules/users/components/user-avatar"
import { BLIP_TYPES, blipId, blipStore, type Blip } from "@/modules/blips/data"
import { TIME } from "@/util/enums"
import { clsx as cx } from "@/util"
import { ptr } from "@/i18n"
import "./blip-comment-editor.css"

type BlipCommentEditorProps = {
  open: boolean
  parentBlipId?: string | null
  editingCommentId?: string | null
  desktopMount?: HTMLDivElement | null
  focusNonce?: number
  closeRequestNonce?: number
  onRequestClose?: () => void
  onAfterClose?: () => void
}

type DesktopStatusContext = {
  canDelete: boolean
  canSave: boolean
  handleDelete: () => void
  handleSave: () => void
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

const tr = ptr("blips.components.commentEditor")
const MOBILE_MAX_WIDTH = 768
const ANIMATION_MS = 260

export function BlipCommentEditor(props: BlipCommentEditorProps) {
  const auth = useAuth()
  const supabase = useSupabase()
  const viewport = useViewport()
  const confirm = useConfirm()
  const store = blipStore(supabase.client, { subscribe: false })
  const [commentId, setCommentId] = createSignal(blipId())
  const [content, setContent] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>("idle")
  const [showStatus, setShowStatus] = createSignal(false)
  const [statusFading, setStatusFading] = createSignal(false)
  const [isDesktopEditorMounted, setIsDesktopEditorMounted] = createSignal(false)
  const [isDesktopEditorOpen, setIsDesktopEditorOpen] = createSignal(false)

  let hideStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let fadeStatusTimeout: ReturnType<typeof setTimeout> | null = null
  let closeAnimationTimeout: ReturnType<typeof setTimeout> | null = null
  let openAnimationFrameId: number | null = null
  let lastHandledCloseRequestNonce: number | undefined

  const isMobileViewport = createMemo(() => viewport.width() <= MOBILE_MAX_WIDTH)

  const existingComment = createMemo(() => {
    if (!props.editingCommentId) {
      return null
    }

    const existing = store.getById(props.editingCommentId)
    if (!existing || existing.blip_type !== BLIP_TYPES.COMMENT) {
      return null
    }

    return existing
  })

  createEffect(() => {
    if (!props.open) {
      return
    }

    const existing = existingComment()
    if (existing) {
      setCommentId(existing.id)
      setContent(existing.content ?? "")
      return
    }

    setCommentId(blipId())
    setContent("")
  })

  const canSave = createMemo(
    () =>
      Boolean(props.parentBlipId) &&
      Boolean(auth.user()?.id) &&
      content().trim().length > 0 &&
      !isSaving(),
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

  const clearOpenAnimationFrame = () => {
    if (openAnimationFrameId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(openAnimationFrameId)
      openAnimationFrameId = null
    }
  }

  const clearCloseAnimationTimeout = () => {
    if (closeAnimationTimeout) {
      clearTimeout(closeAnimationTimeout)
      closeAnimationTimeout = null
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

  const resetEditorState = () => {
    setCommentId(blipId())
    setContent("")
    setIsSaving(false)
    setSaveStatus("idle")
    setShowStatus(false)
    setStatusFading(false)
  }

  createEffect(() => {
    if (!props.open || isMobileViewport()) {
      return
    }

    clearCloseAnimationTimeout()
    clearOpenAnimationFrame()
    setIsDesktopEditorMounted(true)
    setIsDesktopEditorOpen(false)

    if (typeof window !== "undefined") {
      openAnimationFrameId = window.requestAnimationFrame(() => {
        setIsDesktopEditorOpen(true)
        openAnimationFrameId = null
      })
      return
    }

    setIsDesktopEditorOpen(true)
  })

  createEffect(() => {
    if (props.open || isMobileViewport()) {
      if (!props.open && isMobileViewport()) {
        clearStatusTimeouts()
        resetEditorState()
        props.onAfterClose?.()
      }
      return
    }

    clearStatusTimeouts()
    setIsDesktopEditorOpen(false)
    clearCloseAnimationTimeout()
    closeAnimationTimeout = setTimeout(() => {
      setIsDesktopEditorMounted(false)
      resetEditorState()
      props.onAfterClose?.()
      clearCloseAnimationTimeout()
    }, ANIMATION_MS)
  })

  createEffect(() => {
    const closeRequestNonce = props.closeRequestNonce
    if (closeRequestNonce === undefined) {
      return
    }

    if (closeRequestNonce === lastHandledCloseRequestNonce) {
      return
    }

    lastHandledCloseRequestNonce = closeRequestNonce
    if (!props.open) {
      return
    }

    props.onRequestClose?.()
  })

  onMount(() => {
    if (props.open && !isMobileViewport()) {
      setIsDesktopEditorMounted(true)
    }
  })

  const handleSave = async () => {
    if (!canSave() || !props.parentBlipId || !auth.user()?.id) {
      return
    }

    setIsSaving(true)
    setSaveStatus("saving")
    setShowStatus(true)
    setStatusFading(false)
    const existing = existingComment()
    const result = await store.upsert({
      id: commentId(),
      user_id: auth.user()?.id ?? null,
      parent_id: props.parentBlipId,
      title: null,
      content: content(),
      blip_type: BLIP_TYPES.COMMENT,
      allow_comments: false,
      published: existing?.published ?? false,
      moderation_status: existing?.moderation_status ?? "pending",
    } satisfies Partial<Blip>)
    setIsSaving(false)

    if (result.error) {
      console.error("Failed to save comment:", result.error)
      setSaveStatus("error")
      return
    }

    if (result.data) {
      void store.upsert(
        {
          ...result.data,
          allow_comments: result.data.allow_comments ?? false,
          author:
            existing?.author ??
            (auth.userProfile()?.id
              ? {
                  profile_id: auth.userProfile()?.id ?? null,
                  display_name: auth.userProfile()?.displayName ?? null,
                  avatar_seed: auth.userProfile()?.avatarSeed ?? null,
                  avatar_version: auth.userProfile()?.avatarVersion ?? null,
                }
              : undefined),
        },
        { cacheOnly: true },
      )
    }

    setSaveStatus("saved")
    showStatusWithFade()
    props.onRequestClose?.()
  }

  const handleDelete = () => {
    const existing = existingComment()
    if (!existing) {
      props.onRequestClose?.()
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
        const result = await store.remove(existing.id)
        if (!result.error) {
          props.onRequestClose?.()
        }
      },
    })
  }

  const preventEditorBlur = (event: MouseEvent) => {
    event.preventDefault()
  }

  const MobileControls = (_ctx: MarkdownEditorBelowEditorProps) => (
    <div class="blip-comment-editor-controls">
      <IconButton
        size="xs"
        icon="close"
        aria-label={tr("actions.close")}
        onClick={() => props.onRequestClose?.()}
      />
      <div class="blip-comment-editor-controls-end">
        <Show when={existingComment()}>
          <IconButton
            size="xs"
            icon="delete"
            class="delete"
            aria-label={tr("actions.delete")}
            onClick={handleDelete}
            onMouseDown={preventEditorBlur}
          />
        </Show>
        <IconButton
          size="xs"
          icon="cloud_upload"
          class="blip-action-save"
          aria-label={isSaving() ? tr("actions.saving") : tr("actions.save")}
          disabled={!canSave()}
          onClick={() => {
            void handleSave()
          }}
          onMouseDown={preventEditorBlur}
        />
      </div>
    </div>
  )

  const getStatusIcon = () => {
    const status = saveStatus()

    if (status === "saving") {
      return <LoadingSpinner class="blip-editor-status-spinner" />
    }

    if (status === "saved") {
      return <Icon name="cloud_upload" class="status-saved-icon" />
    }

    return null
  }

  const DesktopControls = (ctx: MarkdownEditorBelowEditorProps) => {
    const statusContext = () => ctx.statusContext as DesktopStatusContext | undefined

    return (
      <div class="blip-editor-below-editor blip-comment-editor-below-editor">
        <div class="blip-editor-control-pill">
          <div class="blip-editor-control-pill-scroll">
            <div class="blip-editor-control-pill-content">
              <div class="blip-editor-control-pill-left">
                <IconButton
                  size="xs"
                  icon="close"
                  class="blip-editor-close"
                  aria-label={tr("actions.close")}
                  onClick={() => props.onRequestClose?.()}
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
                  aria-label="Toggle formatting toolbar"
                  onClick={() => ctx.onToggleToolbar()}
                  onMouseDown={preventEditorBlur}>
                  <Icon name="format_bold" />
                  <Icon name="format_italic" />
                  <Icon name="format_underlined" />
                </button>
                <div class="blip-editor-control-divider" />
                <Show when={statusContext()?.canDelete}>
                  <IconButton
                    size="xs"
                    icon="delete"
                    class="blip-action-delete"
                    aria-label={tr("actions.delete")}
                    onClick={statusContext()?.handleDelete}
                    onMouseDown={preventEditorBlur}
                  />
                </Show>
                <IconButton
                  size="xs"
                  icon="cloud_upload"
                  class="blip-action-save"
                  aria-label={isSaving() ? tr("actions.saving") : tr("actions.save")}
                  disabled={!statusContext()?.canSave}
                  onClick={statusContext()?.handleSave}
                  onMouseDown={preventEditorBlur}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const DesktopEditorSurface = () => (
    <div class="inline-shell" classList={{ "is-open": isDesktopEditorOpen() }}>
      <div class="bubble">
        <EditorShell
          transitionClass="blip-comment-editor-shell"
          shellClass="blip-comment-editor-surface"
          bodyClass="blip-comment-editor-body"
          focusProxyAriaLabel={tr("placeholder")}
          icon="add_comment"
          showFocusProxy={false}
          isOpen={isDesktopEditorOpen()}
          Header={
            <div class="blip-comment-editor-top-row">
              <div class="blip-comment-editor-mode-label">{tr("modeLabel")}</div>
            </div>
          }>
          <form
            class="blip-editor-form blip-comment-editor-form"
            onSubmit={event => {
              event.preventDefault()
              void handleSave()
            }}>
            <MarkdownEditor
              instanceKey={`blip-comment-editor:${commentId()}`}
              focusNonce={props.focusNonce}
              focusCaretPlacement="end"
              placeholder={tr("placeholder")}
              initialValue={content()}
              onChange={setContent}
              BelowEditor={DesktopControls}
              statusIcon={getStatusIcon()}
              showStatus={showStatus()}
              statusFading={statusFading()}
              showStatusBar={false}
              statusContext={{
                canDelete: Boolean(existingComment()),
                canSave: canSave(),
                handleDelete,
                handleSave: () => {
                  void handleSave()
                },
              }}
            />
          </form>
        </EditorShell>
      </div>
      <div class="avatar-column" aria-hidden="true">
        <div class="avatar-wrap">
          <UserAvatar
            role={auth.isSuperuser() ? "superuser" : null}
            class="avatar"
            size="md"
            variant="surface"
            displayName={auth.userProfile()?.displayName ?? auth.user()?.email ?? null}
            avatarSeed={auth.userProfile()?.avatarSeed ?? null}
            avatarVersion={auth.userProfile()?.avatarVersion ?? null}
          />
        </div>
      </div>
    </div>
  )

  onCleanup(() => {
    clearStatusTimeouts()
    clearOpenAnimationFrame()
    clearCloseAnimationTimeout()
  })

  return (
    <Show
      when={
        (isMobileViewport() ? props.open : isDesktopEditorMounted())
          ? commentId()
          : null
      }
      keyed>
      {_commentId => (
        <Show
          when={isMobileViewport()}
          fallback={
            props.desktopMount ? (
              <Portal mount={props.desktopMount}>
                <div class="blip-comment-editor-layer">
                  <DesktopEditorSurface />
                </div>
              </Portal>
            ) : null
          }>
          <Dialog
            open={props.open}
            onOpenChange={open => {
              if (!open) {
                props.onRequestClose?.()
              }
            }}
            class="blip-comment-editor-dialog"
            modal
            preventScroll>
            <DialogHeader class="blip-comment-editor-header">
              <DialogTitle>
                {existingComment() ? tr("titles.edit") : tr("titles.new")}
              </DialogTitle>
            </DialogHeader>
            <DialogBody class="blip-comment-editor-body">
              <MarkdownEditor
                instanceKey={`blip-comment-editor:${commentId()}`}
                focusNonce={props.focusNonce}
                focusCaretPlacement="end"
                placeholder={tr("placeholder")}
                initialValue={content()}
                onChange={setContent}
                BelowEditor={MobileControls}
                showStatusBar={false}
              />
            </DialogBody>
          </Dialog>
        </Show>
      )}
    </Show>
  )
}
