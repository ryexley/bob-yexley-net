import { createEffect, createMemo, createSignal, Show } from "solid-js"
import {
  MarkdownEditor,
  type MarkdownEditorBelowEditorProps,
} from "@/components/markdown/editor"
import { Button } from "@/components/button"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@/components/dialog"
import { IconButton } from "@/components/icon-button"
import { useConfirm } from "@/components/confirm-dialog"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { BLIP_TYPES, blipId, blipStore, type Blip } from "@/modules/blips/data"
import { ptr } from "@/i18n"
import "./blip-comment-editor.css"

type BlipCommentEditorProps = {
  open: boolean
  parentBlipId?: string | null
  editingCommentId?: string | null
  focusNonce?: number
  onRequestClose?: () => void
}

const tr = ptr("blips.components.commentEditor")

export function BlipCommentEditor(props: BlipCommentEditorProps) {
  const auth = useAuth()
  const supabase = useSupabase()
  const confirm = useConfirm()
  const store = blipStore(supabase.client, { subscribe: false })
  const [commentId, setCommentId] = createSignal(blipId())
  const [content, setContent] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)

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
      setCommentId(blipId())
      setContent("")
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

  createEffect(() => {
    props.focusNonce
  })

  const canSave = createMemo(
    () =>
      Boolean(props.parentBlipId) &&
      Boolean(auth.user()?.id) &&
      content().trim().length > 0 &&
      !isSaving(),
  )

  const handleSave = async () => {
    if (!canSave() || !props.parentBlipId || !auth.user()?.id) {
      return
    }

    setIsSaving(true)
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
      return
    }

    if (result.data) {
      void store.upsert(
        {
          ...result.data,
          allow_comments: result.data.allow_comments ?? false,
          author:
            existing?.author ??
            (auth.visitor()?.id
              ? {
                  visitor_id: auth.visitor()?.id ?? null,
                  display_name: auth.visitor()?.displayName ?? null,
                  avatar_seed: auth.visitor()?.avatarSeed ?? null,
                  avatar_version: auth.visitor()?.avatarVersion ?? null,
                }
              : undefined),
        },
        { cacheOnly: true },
      )
    }

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

  const Controls = (_ctx: MarkdownEditorBelowEditorProps) => (
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
          />
        </Show>
        <Button
          variant="primary"
          size="xs"
          label={isSaving() ? tr("actions.saving") : tr("actions.save")}
          disabled={!canSave()}
          onClick={() => {
            void handleSave()
          }}
        />
      </div>
    </div>
  )

  return (
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
          BelowEditor={Controls}
          showStatusBar={false}
        />
      </DialogBody>
    </Dialog>
  )
}
