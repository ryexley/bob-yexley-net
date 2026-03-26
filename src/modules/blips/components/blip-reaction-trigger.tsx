import { createEffect, createMemo, createSignal } from "solid-js"
import { useNotify } from "@/components/notification"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { useVisitorAuth } from "@/modules/auth/components/visitor-auth-modal"
import { ReactionPicker } from "@/modules/blips/components/reaction-picker"
import {
  buildOptimisticReactionState,
  createReactionStateOverride,
} from "@/modules/blips/data/reaction-optimistic"
import { REACTION_ERROR_I18N_KEY } from "@/modules/blips/data/errors"
import {
  MAX_REACTIONS_PER_BLIP,
  reactionStore,
  type Blip,
} from "@/modules/blips/data"
import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"
import { ptr } from "@/i18n"

type BlipReactionTriggerProps = {
  blip: Pick<Blip, "id" | "reactions" | "my_reaction_count" | "reactions_count">
  triggerAriaLabel: string
  onTriggerInteraction?: (event: MouseEvent) => void
  onReactionStateChange?: (next: {
    reactions: BlipReactionSummary[]
    myReactionCount: number
    reactionsCount: number
  }) => void
}

const tr = ptr("blips.reactions")

export function BlipReactionTrigger(props: BlipReactionTriggerProps) {
  const supabase = useSupabase()
  const { isAuthenticated, visitor } = useAuth()
  const visitorAuth = useVisitorAuth()
  const notify = useNotify()
  const reactions = reactionStore(supabase.client, { subscribe: false })
  const [open, setOpen] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [activeEmojisOverride, setActiveEmojisOverride] = createSignal<string[] | null>(
    null,
  )
  const [myReactionCountOverride, setMyReactionCountOverride] = createSignal<
    number | null
  >(null)

  const reactionSignature = createMemo(() =>
    (props.blip.reactions ?? [])
      .map(reaction =>
        [
          reaction.emoji,
          reaction.count,
          reaction.reacted_by_current_user ? "1" : "0",
        ].join(":"),
      )
      .join("|"),
  )

  const activeEmojisFromBlip = createMemo(() =>
    (props.blip.reactions ?? [])
      .filter(reaction => reaction.reacted_by_current_user)
      .map(reaction => reaction.emoji),
  )

  const activeEmojis = createMemo(() =>
    activeEmojisOverride() ?? activeEmojisFromBlip(),
  )

  const myReactionCount = createMemo(() =>
    myReactionCountOverride() ?? props.blip.my_reaction_count ?? 0,
  )

  const limitReached = createMemo(
    () => myReactionCount() >= MAX_REACTIONS_PER_BLIP,
  )

  createEffect(() => {
    props.blip.id
    props.blip.my_reaction_count
    reactionSignature()
    setActiveEmojisOverride(null)
    setMyReactionCountOverride(null)
  })

  createEffect(() => {
    if (!limitReached()) {
      return
    }

    setOpen(false)
  })

  createEffect(() => {
    if (isAuthenticated()) {
      return
    }

    setOpen(false)
  })

  const openAuthThenPicker = () => {
    visitorAuth.open({
      onSuccess: () => {
        queueMicrotask(() => setOpen(true))
      },
    })
  }

  const handleTriggerClick = (event: MouseEvent) => {
    props.onTriggerInteraction?.(event)

    if (busy()) {
      event.preventDefault()
      return
    }

    if (!isAuthenticated()) {
      event.preventDefault()
      openAuthThenPicker()
      return
    }

    if (limitReached()) {
      event.preventDefault()
      setOpen(false)
      notify.info({
        content: tr("tooltips.limitReached"),
      })
      return
    }
  }

  const handleToggleReaction = async (emoji: string) => {
    if (busy()) {
      return
    }

    const previousActiveEmojis = activeEmojis()
    const previousCount = myReactionCount()
    const previousReactions = props.blip.reactions ?? []
    const currentlyActive = previousActiveEmojis.includes(emoji)
    const nextActiveEmojis = currentlyActive
      ? previousActiveEmojis.filter(value => value !== emoji)
      : [...new Set([...previousActiveEmojis, emoji])]
    const optimisticOverride = buildOptimisticReactionState({
      reactions: previousReactions,
      myReactionCount: previousCount,
      emoji,
      nextActive: !currentlyActive,
      visitorDisplayName: visitor()?.displayName ?? null,
    })

    setBusy(true)
    setActiveEmojisOverride(nextActiveEmojis)
    setMyReactionCountOverride(optimisticOverride.my_reaction_count)
    props.onReactionStateChange?.({
      reactions: optimisticOverride.reactions,
      myReactionCount: optimisticOverride.my_reaction_count,
      reactionsCount: optimisticOverride.reactions_count,
    })
    const result = await reactions.toggleReaction(props.blip.id, emoji, {
      visitorId: visitor()?.id ?? null,
      visitorStatus: visitor()?.status ?? null,
      currentCount: previousCount,
      hasActiveReaction: currentlyActive,
    })
    setBusy(false)

    if (result.error || !result.data) {
      setActiveEmojisOverride(previousActiveEmojis)
      setMyReactionCountOverride(previousCount)
      const rollbackOverride = createReactionStateOverride(
        previousReactions,
        previousCount,
      )
      props.onReactionStateChange?.({
        reactions: rollbackOverride.reactions,
        myReactionCount: rollbackOverride.my_reaction_count,
        reactionsCount: rollbackOverride.reactions_count,
      })
      const errorKey =
        REACTION_ERROR_I18N_KEY[result.error ?? "UNKNOWN"] ??
        REACTION_ERROR_I18N_KEY.UNKNOWN
      notify.error({ content: errorKey })
      return
    }

    const confirmedActiveEmojis = result.data.active
      ? [...new Set([...activeEmojis(), emoji])]
      : activeEmojis().filter(value => value !== emoji)

    setActiveEmojisOverride(confirmedActiveEmojis)
    setMyReactionCountOverride(result.data.myReactionCount)
    props.onReactionStateChange?.({
      reactions: optimisticOverride.reactions,
      myReactionCount: result.data.myReactionCount,
      reactionsCount: optimisticOverride.reactions_count,
    })
  }

  return (
    <ReactionPicker
      open={open()}
      onOpenChange={setOpen}
      onTriggerClick={handleTriggerClick}
      onToggleReaction={emoji => void handleToggleReaction(emoji)}
      activeEmojis={activeEmojis()}
      triggerAriaLabel={props.triggerAriaLabel}
      limitReached={isAuthenticated() && limitReached()}
      busy={busy()}
    />
  )
}
