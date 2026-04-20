import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { Icon } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { useNotify } from "@/components/notification"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { useConfirm } from "@/components/confirm-dialog"
import { RequiresAdmin } from "@/modules/auth/components/requires-role"
import { BlipReactionSummary } from "@/modules/blips/components/blip-reaction-summary"
import { BlipReactionTrigger } from "@/modules/blips/components/blip-reaction-trigger"
import { UserAvatar } from "@/modules/users/components/user-avatar"
import { useBlipComposer } from "@/modules/blips/context/blip-composer-context"
import {
  buildOptimisticReactionState,
  createReactionStateOverride,
  getReactionSignature,
  type ReactionStateOverride,
} from "@/modules/blips/data/reaction-optimistic"
import { REACTION_ERROR_I18N_KEY } from "@/modules/blips/data/errors"
import { BLIP_TYPES, blipStore, reactionStore, type Blip } from "@/modules/blips/data"
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

type BlipCommentListItemProps = {
  comment: Blip
  parentBlip: Blip
}

const tr = ptr("blips.components.commentThread")
const trBlip = ptr("blips.components.blip")
const trCommentEditor = ptr("blips.components.commentEditor")
const COMMENT_KIND_ICON = "forum"

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

type BlipCommentCardProps = {
  comment: Blip
  parentBlipId: string
  canModerate: boolean
  avatarSide: "left" | "right"
  onDelete: (comment: Blip) => void
  onApprove: (comment: Blip) => void
  onReject: (comment: Blip) => void
}

function BlipCommentCard(props: BlipCommentCardProps) {
  const auth = useAuth()
  const supabase = useSupabase()
  const notify = useNotify()
  const composer = useBlipComposer()
  const blips = blipStore(supabase.client, { subscribe: false })
  const reactions = reactionStore(supabase.client, { subscribe: false })
  const [isReactionBusy, setIsReactionBusy] = createSignal(false)
  const [reactionStateOverride, setReactionStateOverride] =
    createSignal<ReactionStateOverride | null>(null)

  const reactionSignature = createMemo(() => getReactionSignature(props.comment.reactions ?? []))
  const displayComment = createMemo(() => {
    const override = reactionStateOverride()
    if (!override) {
      return props.comment
    }

    return {
      ...props.comment,
      reactions: override.reactions,
      my_reaction_count: override.my_reaction_count,
      reactions_count: override.reactions_count,
    }
  })
  const canEdit = createMemo(
    () =>
      auth.isAuthenticated() &&
      (auth.user()?.id === props.comment.user_id || auth.isSuperuser()),
  )
  const canDelete = createMemo(
    () =>
      auth.isAuthenticated() &&
      (auth.user()?.id === props.comment.user_id || props.canModerate),
  )

  createEffect(() => {
    props.comment.id
    props.comment.my_reaction_count
    props.comment.reactions_count
    reactionSignature()
    setReactionStateOverride(null)
  })

  const handleToggleReaction = async (emoji: string) => {
    if (isReactionBusy()) {
      return
    }

    const currentComment = displayComment()
    const previousReactions = currentComment.reactions ?? []
    const previousCount = currentComment.my_reaction_count ?? 0
    const hasActiveReaction =
      previousReactions.find(reaction => reaction.emoji === emoji)?.reacted_by_current_user ??
      false
    const optimisticOverride = buildOptimisticReactionState({
      reactions: previousReactions,
      myReactionCount: previousCount,
      emoji,
      nextActive: !hasActiveReaction,
      visitorDisplayName: auth.userProfile()?.displayName ?? null,
    })
    const applyVisibleReactionState = (next: ReactionStateOverride) => {
      setReactionStateOverride(next)
      blips.updateCachedReactionState(props.comment.id, next)
    }

    setIsReactionBusy(true)
    applyVisibleReactionState(optimisticOverride)

    const result = await reactions.toggleReaction(props.comment.id, emoji, {
      profileId: auth.userProfile()?.id ?? null,
      status: auth.userSystem()?.status ?? null,
      currentCount: previousCount,
      hasActiveReaction,
    })

    setIsReactionBusy(false)

    if (result.error || !result.data) {
      applyVisibleReactionState(createReactionStateOverride(previousReactions, previousCount))
      const errorKey =
        REACTION_ERROR_I18N_KEY[result.error ?? "UNKNOWN"] ??
        REACTION_ERROR_I18N_KEY.UNKNOWN
      notify.error({ content: errorKey })
      return
    }

    applyVisibleReactionState({
      ...optimisticOverride,
      my_reaction_count: result.data.myReactionCount,
    })
  }

  return (
    <li
      class={cx("blip-comment-stack", {
        "avatar-left": props.avatarSide === "left",
        "avatar-right": props.avatarSide === "right",
        "root-comment": props.avatarSide === "left",
        "update-comment": props.avatarSide === "right",
      })}>
      <article
        class="blip-comment"
        classList={{
          pending: isPendingComment(props.comment),
        }}>
        <header class="blip-comment-header">
          <span class="blip-comment-kind">
            <Icon
              name={COMMENT_KIND_ICON}
              class="blip-comment-kind-icon"
            />
            <span>{trCommentEditor("modeLabel")}</span>
          </span>
          <span class="blip-comment-timestamp">
            {formatBlipTimestamp(props.comment.created_at)}
          </span>
        </header>
        <div class="blip-comment-content">
          <Markdown content={props.comment.content ?? ""} />
        </div>
        <footer>
          <div class="reactions">
            <Show when={isPendingComment(props.comment)}>
              <span class="blip-comment-status pending">
                {tr("statuses.pending")}
              </span>
            </Show>
            <Show when={props.comment.moderation_status === "rejected"}>
              <span class="blip-comment-status rejected">
                {tr("statuses.rejected")}
              </span>
            </Show>
            <BlipReactionSummary
              class="blip-comment-reactions"
              reactions={displayComment().reactions}
              busy={isReactionBusy()}
              onToggleReaction={
                auth.isAuthenticated()
                  ? emoji => {
                      void handleToggleReaction(emoji)
                    }
                  : undefined
              }
            />
          </div>
          <div class="actions">
            <div
              class="blip-comment-actions"
              role="toolbar"
              aria-label={tr("actions.toolbarAriaLabel")}>
              <Show when={canEdit()}>
                <IconButton
                  size="xs"
                  icon="edit_note"
                  class="edit"
                  aria-label={tr("actions.edit")}
                  onClick={() =>
                    composer.openEditComment(props.parentBlipId, props.comment.id)
                  }
                />
              </Show>
              <Show when={canDelete()}>
                <IconButton
                  size="xs"
                  icon="delete"
                  class="delete"
                  aria-label={tr("actions.delete")}
                  onClick={() => props.onDelete(props.comment)}
                />
              </Show>
              <RequiresAdmin>
                <Show when={props.comment.moderation_status === "pending"}>
                  <IconButton
                    size="xs"
                    icon="check_circle"
                    class="approve"
                    aria-label={tr("actions.approve")}
                    onClick={() => {
                      props.onApprove(props.comment)
                    }}
                  />
                  <IconButton
                    size="xs"
                    icon="cancel"
                    class="reject"
                    aria-label={tr("actions.reject")}
                    onClick={() => {
                      props.onReject(props.comment)
                    }}
                  />
                </Show>
              </RequiresAdmin>
            </div>
            <BlipReactionTrigger
              blip={displayComment()}
              triggerAriaLabel={trBlip("actions.addReaction")}
              onReactionStateChange={next => {
                const nextState = {
                  reactions: next.reactions,
                  my_reaction_count: next.myReactionCount,
                  reactions_count: next.reactionsCount,
                }
                setReactionStateOverride(nextState)
                blips.updateCachedReactionState(props.comment.id, nextState)
              }}
            />
          </div>
        </footer>
      </article>
      <div class="avatar-column" aria-hidden="true">
        <div class="avatar-wrap">
          <UserAvatar
            size="md"
            variant="surface"
            displayName={props.comment.author?.display_name ?? tr("unknownAuthor")}
            avatarSeed={props.comment.author?.avatar_seed ?? null}
            avatarVersion={props.comment.author?.avatar_version ?? null}
          />
        </div>
      </div>
    </li>
  )
}

export function BlipCommentListItem(props: BlipCommentListItemProps) {
  const auth = useAuth()
  const supabase = useSupabase()
  const confirm = useConfirm()
  const store = blipStore(supabase.client, { subscribe: false })
  const canModerate = createMemo(() => auth.isAuthenticated() && auth.isAdmin())
  const avatarSide = createMemo<"left" | "right">(() =>
    props.parentBlip.blip_type === BLIP_TYPES.UPDATE ? "right" : "left",
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
    <BlipCommentCard
      comment={props.comment}
      parentBlipId={props.parentBlip.id}
      canModerate={canModerate()}
      avatarSide={avatarSide()}
      onDelete={handleDelete}
      onApprove={comment => {
        void handleApprove(comment)
      }}
      onReject={comment => {
        void handleReject(comment)
      }}
    />
  )
}

export function BlipCommentThread(props: BlipCommentThreadProps) {
  const composer = useBlipComposer()
  const avatarSide = createMemo<"left" | "right">(() =>
    props.parentBlip.blip_type === BLIP_TYPES.UPDATE ? "right" : "left",
  )
  const showSection = createMemo(
    () =>
      props.comments.length > 0 ||
      !commentsEnabled(props.parentBlip) ||
      composer.isCommentOpenFor(props.parentBlip.id),
  )

  return (
    <Show when={showSection()}>
      <section
        class={cx("blip-comment-thread", {
          "root-comments": avatarSide() === "left",
          "update-comments": avatarSide() === "right",
        })}>
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
                <BlipCommentListItem
                  comment={comment}
                  parentBlip={props.parentBlip}
                />
              )}
            </For>
          </ul>
        </Show>
      </section>
    </Show>
  )
}
