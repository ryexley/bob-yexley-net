import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { A, useNavigate, usePreloadRoute } from "@solidjs/router"
import {
  createMemo,
  createSignal,
  createEffect,
  For,
  onCleanup,
  onMount,
  splitProps,
  Show,
} from "solid-js"
// import { Icon } from "@/components/icon"
import { Hashtag, Icon } from "@/components/icon"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { useNotify } from "@/components/notification"
import { Tooltip } from "@/components/tooltip"
import { Button } from "@/components/button"
import { Stack } from "@/components/stack"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { BlipReactionSummary } from "@/modules/blips/components/blip-reaction-summary"
import { BlipReactionTrigger } from "@/modules/blips/components/blip-reaction-trigger"
import { blipStore } from "@/modules/blips/data/store"
import {
  buildOptimisticReactionState,
  createReactionStateOverride,
  getReactionSignature,
  type ReactionStateOverride,
} from "@/modules/blips/data/reaction-optimistic"
import { REACTION_ERROR_I18N_KEY } from "@/modules/blips/data/errors"
import { reactionStore } from "@/modules/blips/data/reactions-store"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { clsx as cx } from "@/util"
import "./blip.css"

const tr = ptr("blips.components.blip")

export function Blip(props: {
  blip: BlipType
  tags?: string[]
  onEdit?: (blipId: string) => void
  onView?: (blipId: string) => void
}) {
  const [local] = splitProps(props, ["blip", "tags", "onEdit", "onView"])
  const navigate = useNavigate()
  const preloadRoute = usePreloadRoute()
  const { isAuthenticated, userProfile, userSystem } = useAuth()
  const supabase = useSupabase()
  const notify = useNotify()
  const blips = blipStore(supabase.client, { subscribe: false })
  const reactions = reactionStore(supabase.client, { subscribe: false })
  let contentRef: HTMLDivElement | undefined
  const [timeTick, setTimeTick] = createSignal(Date.now())
  const [isClipped, setIsClipped] = createSignal(false)
  const [isReactionBusy, setIsReactionBusy] = createSignal(false)
  const [reactionStateOverride, setReactionStateOverride] =
    createSignal<ReactionStateOverride | null>(null)
  const reactionSignature = createMemo(() => getReactionSignature(local.blip.reactions ?? []))
  const displayBlip = createMemo(() => {
    const override = reactionStateOverride()
    if (!override) {
      return local.blip
    }

    return {
      ...local.blip,
      reactions: override.reactions,
      my_reaction_count: override.my_reaction_count,
      reactions_count: override.reactions_count,
    }
  })
  const timestampLabel = createMemo(() => {
    timeTick()
    return formatBlipTimestamp(local.blip.created_at)
  })
  const canOpenDetails = () => isClipped() || typeof local.onView === "function"
  const hasUpdates = () => (local.blip.updates_count ?? 0) > 0
  const hasComments = () => (local.blip.comments_count ?? 0) > 0

  createEffect(() => {
    local.blip.id
    local.blip.my_reaction_count
    local.blip.reactions_count
    reactionSignature()
    setReactionStateOverride(null)
  })

  const preloadDetails = () => {
    if (typeof local.onView !== "function") {
      return
    }

    preloadRoute(pages.blip(local.blip.id), { preloadData: true })
  }

  const openDetails = () => {
    if (typeof local.onView === "function") {
      local.onView(local.blip.id)
      return
    }

    navigate(pages.blip(local.blip.id), {
      scroll: true,
      state: { fromBlips: true },
    })
  }

  const openDetailsIfNeeded = () => {
    if (!canOpenDetails()) {
      return
    }
    openDetails()
  }

  const onMainKeyDown = (event: KeyboardEvent) => {
    if (!canOpenDetails()) {
      return
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }
    event.preventDefault()
    openDetails()
  }

  onMount(() => {
    if (contentRef) {
      setIsClipped(contentRef.scrollHeight > contentRef.clientHeight)
    }

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
      blips.updateCachedReactionState(local.blip.id, next)
    }

    setIsReactionBusy(true)
    applyVisibleReactionState(optimisticOverride)

    const result = await reactions.toggleReaction(local.blip.id, emoji, {
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
    <li>
      <Stack>
        <div
          class="blip"
          classList={{ "blip--unpublished": !local.blip.published }}>
          <div
            class={cx("blip-main", { interactive: canOpenDetails() })}
            onPointerEnter={preloadDetails}
            onFocus={preloadDetails}
            onTouchStart={preloadDetails}
            onClick={openDetailsIfNeeded}
            onKeyDown={onMainKeyDown}
            role={canOpenDetails() ? "button" : undefined}
            tabIndex={canOpenDetails() ? 0 : undefined}>
            <header>
              <span class="timestamp">
                {/* TODO: wrap this in a tooltip that shows the full timestamp */}
                {timestampLabel()}
              </span>
            </header>
            <div
              ref={contentRef}
              class={cx("blip-content", { preview: isClipped() })}>
              <Markdown content={local.blip.content} />
              <Show when={canOpenDetails()}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={event => {
                    event.stopPropagation()
                    openDetails()
                  }}
                  class="read-more"
                  label={tr("actions.readMore")}
                  iconRight="arrow_forward"
                />
              </Show>
            </div>
          </div>
          <footer>
            <div class="tags">
              <Show when={(local.tags?.length ?? 0) > 0}>
                <Hashtag size="0.85rem" />
                <ul class="tag-list">
                  <For each={local.tags}>
                    {tag => (
                      <li class="tag">
                        <A href={pages.blipsTag(tag)}>{tag}</A>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
            <Stack
              orient="row"
              gap="0.5rem"
              class="activity">
              <Show when={hasUpdates()}>
                <Tooltip
                  content={tr("actions.updatesTooltip", {
                    count: local.blip.updates_count ?? 0,
                  })}>
                  <button
                    type="button"
                    class="activity-indicator updates-indicator"
                    aria-label={tr("actions.updatesTooltip", {
                      count: local.blip.updates_count ?? 0,
                    })}
                    onClick={event => {
                      event.stopPropagation()
                      openDetails()
                    }}>
                    <Icon name="chat" />
                    <span>{local.blip.updates_count ?? 0}</span>
                  </button>
                </Tooltip>
              </Show>
              <Show when={hasComments()}>
                <Tooltip
                  content={tr("actions.commentsTooltip", {
                    count: local.blip.comments_count ?? 0,
                  })}>
                  <button
                    type="button"
                    class="activity-indicator comments-indicator"
                    aria-label={tr("actions.commentsTooltip", {
                      count: local.blip.comments_count ?? 0,
                    })}
                    onClick={event => {
                      event.stopPropagation()
                      openDetails()
                    }}>
                    <Icon name="forum" />
                    <span>{local.blip.comments_count ?? 0}</span>
                  </button>
                </Tooltip>
              </Show>
              <BlipReactionTrigger
                blip={displayBlip()}
                triggerAriaLabel={tr("actions.addReaction")}
                onTriggerInteraction={event => {
                  event.stopPropagation()
                }}
                onReactionStateChange={next => {
                  const nextState = {
                    reactions: next.reactions,
                    my_reaction_count: next.myReactionCount,
                    reactions_count: next.reactionsCount,
                  }
                  setReactionStateOverride(nextState)
                  blips.updateCachedReactionState(local.blip.id, nextState)
                }}
              />
            </Stack>
          </footer>
        </div>
        <div class="blip-meta-row">
          <div class="blip-meta-row-start">
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
          </div>
          <BlipActions
            blip={local.blip}
            onEdit={local.onEdit}
            fullWidth={false}
          />
        </div>
      </Stack>
    </li>
  )
}
