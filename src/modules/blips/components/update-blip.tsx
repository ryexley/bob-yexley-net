import type { Blip } from "@/modules/blips/data/schema"
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { useNotify } from "@/components/notification"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { BlipCommentTrigger } from "@/modules/blips/components/blip-comment-trigger"
import { BlipReactionSummary } from "@/modules/blips/components/blip-reaction-summary"
import { BlipReactionTrigger } from "@/modules/blips/components/blip-reaction-trigger"
import {
  buildOptimisticReactionState,
  createReactionStateOverride,
  getReactionSignature,
  type ReactionStateOverride,
} from "@/modules/blips/data/reaction-optimistic"
import { REACTION_ERROR_I18N_KEY } from "@/modules/blips/data/errors"
import { reactionStore } from "@/modules/blips/data/reactions-store"
import { blipStore } from "@/modules/blips/data/store"
import { BlipCommentThread } from "@/modules/blips/components/blip-comment-thread"
import { useBlipComposer } from "@/modules/blips/context/blip-composer-context"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import "./update-blip.css"

const tr = ptr("blips.components.blip")

export function UpdateBlip(props: {
  blip: Blip
  comments?: Blip[]
  isRecentRealtime?: boolean
  isShimmering?: boolean
  onEdit?: (blipId: string) => void
}) {
  const supabase = useSupabase()
  const { isAuthenticated, userProfile, userSystem } = useAuth()
  const notify = useNotify()
  const blips = blipStore(supabase.client, { subscribe: false })
  const reactions = reactionStore(supabase.client, { subscribe: false })
  const composer = useBlipComposer()
  const [timeTick, setTimeTick] = createSignal(Date.now())
  const [isReactionBusy, setIsReactionBusy] = createSignal(false)
  const [reactionStateOverride, setReactionStateOverride] =
    createSignal<ReactionStateOverride | null>(null)
  const reactionSignature = createMemo(() => getReactionSignature(props.blip.reactions ?? []))
  const displayBlip = createMemo(() => {
    const override = reactionStateOverride()
    if (!override) {
      return props.blip
    }

    return {
      ...props.blip,
      reactions: override.reactions,
      my_reaction_count: override.my_reaction_count,
      reactions_count: override.reactions_count,
    }
  })
  const timestampLabel = createMemo(() => {
    timeTick()
    return formatBlipTimestamp(props.blip.created_at)
  })

  createEffect(() => {
    props.blip.id
    props.blip.my_reaction_count
    props.blip.reactions_count
    reactionSignature()
    setReactionStateOverride(null)
  })

  onMount(() => {
    const intervalId = setInterval(() => {
      setTimeTick(Date.now())
    }, 60_000)

    onCleanup(() => {
      clearInterval(intervalId)
    })
  })

  const handleToggleReaction = async (emoji: string) => {
    if (isReactionBusy()) {
      return
    }

    const currentBlip = displayBlip()
    const previousReactions = currentBlip.reactions ?? []
    const previousCount = currentBlip.my_reaction_count ?? 0
    const hasActiveReaction =
      previousReactions.find(reaction => reaction.emoji === emoji)?.reacted_by_current_user ??
      false
    const optimisticOverride = buildOptimisticReactionState({
      reactions: previousReactions,
      myReactionCount: previousCount,
      emoji,
      nextActive: !hasActiveReaction,
      visitorDisplayName: userProfile()?.displayName ?? null,
    })
    const applyVisibleReactionState = (next: ReactionStateOverride) => {
      setReactionStateOverride(next)
      blips.updateCachedReactionState(props.blip.id, next)
    }

    setIsReactionBusy(true)
    applyVisibleReactionState(optimisticOverride)

    const result = await reactions.toggleReaction(props.blip.id, emoji, {
      profileId: userProfile()?.id ?? null,
      status: userSystem()?.status ?? null,
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
      class="update-blip-stack">
      <article
        class="update-blip"
        classList={{
          "update-blip--recent-realtime": props.isRecentRealtime === true,
          "update-blip--shimmering": props.isShimmering === true,
          "update-blip--unpublished": !props.blip.published,
        }}>
        <header class="update-blip-header">
          <span class="update-blip-timestamp">
            {timestampLabel()}
          </span>
        </header>
        <div class="update-blip-content">
          <Markdown content={props.blip.content ?? ""} />
        </div>
        <footer class="update-blip-footer">
          <div class="update-blip-footer-end">
            <BlipReactionSummary
              reactions={displayBlip().reactions}
              busy={isReactionBusy()}
              onToggleReaction={
                isAuthenticated()
                  ? emoji => {
                      void handleToggleReaction(emoji)
                    }
                  : undefined
              }
            />
            <BlipActions
              blip={props.blip}
              onEdit={props.onEdit}
            />
            <BlipReactionTrigger
              blip={displayBlip()}
              triggerAriaLabel={tr("actions.addReaction")}
              onReactionStateChange={next => {
                const nextState = {
                  reactions: next.reactions,
                  my_reaction_count: next.myReactionCount,
                  reactions_count: next.reactionsCount,
                }
                setReactionStateOverride(nextState)
                blips.updateCachedReactionState(props.blip.id, nextState)
              }}
            />
            {props.blip.allow_comments !== false ? (
              <BlipCommentTrigger
                onCompose={() => composer.openNewComment(props.blip.id)}
              />
            ) : null}
          </div>
        </footer>
      </article>
      <BlipCommentThread
        parentBlip={props.blip}
        comments={props.comments ?? []}
        showHeader={false}
      />
    </li>
  )
}
