import { For, Show, createMemo } from "solid-js"
import { Button } from "@/components/button"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { useConfirm } from "@/components/confirm-dialog"
import { RequiresAdmin } from "@/modules/auth/components/requires-role"
import { UserAvatar } from "@/modules/users/components/user-avatar"
import { useBlipComposer } from "@/modules/blips/context/blip-composer-context"
import { blipStore, type Blip } from "@/modules/blips/data"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import { clsx as cx } from "@/util"
import "./blip-comment-thread.css"

type BlipCommentThreadProps = {
  parentBlip: Blip
  comments: Blip[]
  showHeader?: boolean
  showInlineMount?: boolean
}

const tr = ptr("blips.components.commentThread")

const isPendingComment = (comment: Blip) =>
  !comment.published || comment.moderation_status === "pending"

const commentsEnabled = (blip: Blip) => blip.allow_comments !== false

const getWritableBlipFields = (blip: Blip): Partial<Blip> => ({
  id: blip.id,
  parent_id: blip.parent_id,
  user_id: blip.user_id,
  title: blip.title,
  content: blip.content,
  published: blip.published,
  moderation_status: blip.moderation_status,
  blip_type: blip.blip_type,
  allow_comments: blip.allow_comments,
})

export function BlipCommentThread(props: BlipCommentThreadProps) {
  const auth = useAuth()
  const supabase = useSupabase()
  const confirm = useConfirm()
  const composer = useBlipComposer()
  const store = blipStore(supabase.client, { subscribe: false })

  const canModerate = createMemo(() => auth.isAuthenticated() && auth.isAdmin())
  const showSection = createMemo(
    () =>
      props.comments.length > 0 ||
      !commentsEnabled(props.parentBlip) ||
      composer.isCommentOpenFor(props.parentBlip.id),
  )

  const patchCommentCache = (comment: Blip, updates: Partial<Blip>) => {
    void store.upsert(
      {
        ...comment,
        ...updates,
        author: comment.author,
      },
      { cacheOnly: true },
    )
  }

  const handleApprove = async (comment: Blip) => {
    const result = await store.upsert({
      ...getWritableBlipFields(comment),
      published: true,
      moderation_status: "approved",
    })

    if (result.data) {
      patchCommentCache(comment, {
        published: true,
        moderation_status: "approved",
      })
    }
  }

  const handleReject = async (comment: Blip) => {
    const result = await store.upsert({
      ...getWritableBlipFields(comment),
      published: false,
      moderation_status: "rejected",
    })

    if (result.data) {
      patchCommentCache(comment, {
        published: false,
        moderation_status: "rejected",
      })
    }
  }

  const handleDelete = (comment: Blip) => {
    confirm({
      title: tr("confirmDelete.title"),
      prompt: tr("confirmDelete.prompt"),
      variant: "destructive",
      confirmationActionLabel: tr("confirmDelete.actions.confirm"),
      confirmationActionLoadingLabel: tr("confirmDelete.actions.confirming"),
      cancelActionLabel: tr("confirmDelete.actions.cancel"),
      onConfirm: async () => {
        await store.remove(comment.id)
      },
    })
  }

  return (
    <Show when={showSection()}>
      <section class="blip-comment-thread">
        <Show when={props.showHeader !== false}>
          <header class="blip-comment-thread-header">
            <div class="blip-comment-thread-heading">
              <span class="blip-comment-thread-heading-label">{tr("title")}</span>
              <span class="blip-comment-thread-count">{props.comments.length}</span>
            </div>
          </header>
        </Show>

        <Show when={props.showInlineMount !== false}>
          <div
            class="blip-comment-thread-inline-mount"
            ref={element =>
              composer.registerCommentInlineMount(props.parentBlip.id, element)
            }
          />
        </Show>

        <Show
          when={props.comments.length > 0}
          fallback={
            <Show when={!commentsEnabled(props.parentBlip)}>
              <p class="blip-comment-thread-empty muted">
                {tr("disabled")}
              </p>
            </Show>
          }>
          <ul class="blip-comment-thread-list">
            <For each={props.comments}>
              {comment => (
                <li
                  class={cx("blip-comment", {
                    pending: isPendingComment(comment),
                  })}>
                  <div class="blip-comment-author-row">
                    <div class="blip-comment-author">
                      <UserAvatar
                        size="sm"
                        variant="surface"
                        displayName={comment.author?.display_name ?? null}
                        avatarSeed={comment.author?.avatar_seed ?? null}
                        avatarVersion={comment.author?.avatar_version ?? null}
                        aria-hidden={true}
                      />
                      <div class="blip-comment-author-copy">
                        <span class="blip-comment-author-name">
                          {comment.author?.display_name ?? tr("unknownAuthor")}
                        </span>
                        <span class="blip-comment-timestamp">
                          {formatBlipTimestamp(comment.created_at)}
                        </span>
                      </div>
                    </div>
                    <div class="blip-comment-meta">
                      <Show when={isPendingComment(comment)}>
                        <span class="blip-comment-status pending">
                          {tr("statuses.pending")}
                        </span>
                      </Show>
                      <Show when={comment.moderation_status === "rejected"}>
                        <span class="blip-comment-status rejected">
                          {tr("statuses.rejected")}
                        </span>
                      </Show>
                    </div>
                  </div>

                  <div class="blip-comment-content">
                    <Markdown content={comment.content ?? ""} />
                  </div>

                  <div class="blip-comment-actions">
                    <Show
                      when={
                        auth.isAuthenticated() &&
                        (auth.user()?.id === comment.user_id || auth.isSuperuser())
                      }>
                      <Button
                        variant="ghost"
                        size="xs"
                        iconLeft="edit_note"
                        label={tr("actions.edit")}
                        onClick={() =>
                          composer.openEditComment(props.parentBlip.id, comment.id)
                        }
                      />
                    </Show>
                    <Show when={auth.isAuthenticated() && (auth.user()?.id === comment.user_id || canModerate())}>
                      <Button
                        variant="ghost"
                        size="xs"
                        iconLeft="delete"
                        label={tr("actions.delete")}
                        onClick={() => handleDelete(comment)}
                      />
                    </Show>
                    <RequiresAdmin>
                      <Show when={comment.moderation_status === "pending"}>
                        <Button
                          variant="ghost"
                          size="xs"
                          iconLeft="check_circle"
                          label={tr("actions.approve")}
                          onClick={() => {
                            void handleApprove(comment)
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="xs"
                          iconLeft="cancel"
                          label={tr("actions.reject")}
                          onClick={() => {
                            void handleReject(comment)
                          }}
                        />
                      </Show>
                    </RequiresAdmin>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </Show>
  )
}
