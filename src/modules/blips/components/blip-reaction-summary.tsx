import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/popover"
import { Tooltip } from "@/components/tooltip"
import { useAuth } from "@/context/auth-context"
import { useViewport } from "@/context/viewport"
import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"
import { cx } from "@/util"
import "./blip-reaction-summary.css"

type BlipReactionSummaryProps = {
  reactions?: BlipReactionSummary[]
  onToggleReaction?: (emoji: string) => void
  busy?: boolean
}

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_THRESHOLD_PX = 12
const MOBILE_MAX_WIDTH = 768
const formatDisplayNames = (names: string[]) => names.join(", ")

export function BlipReactionSummary(props: BlipReactionSummaryProps) {
  const auth = useAuth()
  const viewport = useViewport()
  const reactions = () => props.reactions ?? []
  const [openPopoverEmoji, setOpenPopoverEmoji] = createSignal<string | null>(null)
  const isMobile = createMemo(() => viewport.width() <= MOBILE_MAX_WIDTH)
  const canViewReactionNames = createMemo(() => auth.isAuthenticated())
  const canUseLongPressPopover = createMemo(() => isMobile() && canViewReactionNames())
  let longPressTimeout: ReturnType<typeof setTimeout> | null = null
  let longPressOrigin: { x: number; y: number; emoji: string } | null = null
  let longPressOpenedEmoji: string | null = null

  const clearLongPressTimeout = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout)
      longPressTimeout = null
    }

    longPressOrigin = null
  }

  const getReactionNames = (reaction: BlipReactionSummary) =>
    canViewReactionNames() ? reaction.display_names : []
  const openReactionPopover = (emoji: string) => {
    setOpenPopoverEmoji(emoji)
  }

  const startLongPress = (emoji: string, touch: Touch) => {
    if (!canUseLongPressPopover()) {
      return
    }

    clearLongPressTimeout()
    longPressOpenedEmoji = null
    longPressOrigin = {
      x: touch.clientX,
      y: touch.clientY,
      emoji,
    }
    longPressTimeout = setTimeout(() => {
      longPressOpenedEmoji = emoji
      openReactionPopover(emoji)
      clearLongPressTimeout()
    }, LONG_PRESS_MS)
  }

  const maybeCancelLongPressForMovement = (touch: Touch) => {
    if (!longPressOrigin) {
      return
    }

    const movedBeyondThreshold =
      Math.abs(touch.clientX - longPressOrigin.x) > LONG_PRESS_MOVE_THRESHOLD_PX ||
      Math.abs(touch.clientY - longPressOrigin.y) > LONG_PRESS_MOVE_THRESHOLD_PX

    if (movedBeyondThreshold) {
      clearLongPressTimeout()
    }
  }

  const toggleReaction = (emoji: string) => {
    setOpenPopoverEmoji(null)
    props.onToggleReaction?.(emoji)
  }

  const handleReactionClick = (_event: MouseEvent, emoji: string) => {
    toggleReaction(emoji)
  }

  const handleTouchStart = (
    event: TouchEvent,
    emoji: string,
    allowLongPressPopover: boolean,
  ) => {
    if (!allowLongPressPopover) {
      return
    }

    event.preventDefault()
    const touch = event.touches[0]
    if (touch) {
      startLongPress(emoji, touch)
    }
  }

  const handleTouchMove = (event: TouchEvent, allowLongPressPopover: boolean) => {
    if (!allowLongPressPopover) {
      return
    }

    const touch = event.touches[0]
    if (touch) {
      maybeCancelLongPressForMovement(touch)
    }
  }

  const handleTouchEnd = (
    event: TouchEvent,
    emoji: string,
    canToggle: boolean,
    allowLongPressPopover: boolean,
  ) => {
    if (!allowLongPressPopover) {
      return
    }

    event.preventDefault()
    const opened = longPressOpenedEmoji === emoji
    longPressOpenedEmoji = null
    clearLongPressTimeout()
    if (!opened && canToggle) {
      toggleReaction(emoji)
    }
  }

  createEffect(() => {
    if (canUseLongPressPopover()) {
      return
    }

    setOpenPopoverEmoji(null)
    clearLongPressTimeout()
  })

  onCleanup(() => {
    clearLongPressTimeout()
  })

  return (
    <Show when={reactions().length > 0}>
      <ul class="blip-reaction-summary-list" aria-label="Reactions">
        <For each={reactions()}>
          {reaction => {
            const displayNames = getReactionNames(reaction)
            const tooltipText = formatDisplayNames(displayNames)
            const showDesktopTooltip = !isMobile() && tooltipText.length > 0
            const allowLongPressPopover = canUseLongPressPopover() && tooltipText.length > 0
            const canToggle = Boolean(props.onToggleReaction)
            const detailsContent = (
              <div class="blip-reaction-summary-tooltip-body">
                <div class="blip-reaction-summary-tooltip-emoji" aria-hidden="true">
                  {reaction.emoji}
                </div>
                <div class="blip-reaction-summary-tooltip-names">{tooltipText}</div>
              </div>
            )
            const pillClass = cx(
              "blip-reaction-summary-pill",
              canToggle && "blip-reaction-summary-button",
              reaction.reacted_by_current_user && "reacted",
            )
            const renderChipContent = () => (
              <>
                <span class="emoji" aria-hidden="true">{reaction.emoji}</span>
                <span class="count">{reaction.count}</span>
              </>
            )
            const desktopTriggerProps = canToggle
              ? {
                  type: "button" as const,
                  disabled: props.busy,
                  "aria-label": `${reaction.reacted_by_current_user ? "Remove" : "Add"} ${reaction.emoji} reaction`,
                  onClick: (event: MouseEvent) => handleReactionClick(event, reaction.emoji),
                }
              : undefined
            const desktopTrigger = canToggle ? (
              <button class={pillClass} {...desktopTriggerProps}>
                {renderChipContent()}
              </button>
            ) : (
              <span class={pillClass}>{renderChipContent()}</span>
            )
            const desktopChip = showDesktopTooltip ? (
              <Tooltip
                content={detailsContent}
                contentClass="blip-reaction-summary-tooltip"
                triggerAs={canToggle ? "button" : "span"}
                triggerClass={pillClass}
                triggerProps={desktopTriggerProps}>
                {renderChipContent()}
              </Tooltip>
            ) : (
              desktopTrigger
            )

            const chip = (
              <Show
                when={props.onToggleReaction}
                fallback={
                  <span
                    class="blip-reaction-summary-pill"
                    classList={{
                      reacted: reaction.reacted_by_current_user,
                    }}
                    onTouchStart={event =>
                      handleTouchStart(event, reaction.emoji, allowLongPressPopover)
                    }
                    onTouchMove={event => handleTouchMove(event, allowLongPressPopover)}
                    onTouchEnd={event =>
                      handleTouchEnd(event, reaction.emoji, false, allowLongPressPopover)
                    }
                    onTouchCancel={clearLongPressTimeout}
                    onContextMenu={event => {
                      if (allowLongPressPopover) {
                        event.preventDefault()
                        openReactionPopover(reaction.emoji)
                      }
                    }}>
                    {renderChipContent()}
                  </span>
                }>
                <button
                  type="button"
                  class="blip-reaction-summary-pill blip-reaction-summary-button"
                  classList={{
                    reacted: reaction.reacted_by_current_user,
                  }}
                  disabled={props.busy}
                  aria-label={`${reaction.reacted_by_current_user ? "Remove" : "Add"} ${reaction.emoji} reaction`}
                  onClick={event => handleReactionClick(event, reaction.emoji)}
                  onTouchStart={event =>
                    handleTouchStart(event, reaction.emoji, allowLongPressPopover)
                  }
                  onTouchMove={event => handleTouchMove(event, allowLongPressPopover)}
                  onTouchEnd={event =>
                    handleTouchEnd(event, reaction.emoji, canToggle, allowLongPressPopover)
                  }
                  onTouchCancel={clearLongPressTimeout}
                  onContextMenu={event => {
                    if (allowLongPressPopover) {
                      event.preventDefault()
                      openReactionPopover(reaction.emoji)
                    }
                  }}>
                  {renderChipContent()}
                </button>
              </Show>
            )

            return (
              <li class="blip-reaction-summary-item">
                <Show
                  when={allowLongPressPopover}
                  fallback={
                    desktopChip
                  }>
                  <Popover
                    open={openPopoverEmoji() === reaction.emoji}
                    onOpenChange={open => {
                      if (!open && openPopoverEmoji() === reaction.emoji) {
                        setOpenPopoverEmoji(null)
                      }
                    }}
                    gutter={8}
                    placement="top"
                    flip
                    shift={8}>
                    <PopoverAnchor as="span">{chip}</PopoverAnchor>
                    <PopoverContent
                      class="blip-reaction-summary-popover"
                      role="dialog"
                      aria-label={`Reactions for ${reaction.emoji}`}>
                      <div class="blip-reaction-summary-popover-emoji" aria-hidden="true">
                        {reaction.emoji}
                      </div>
                      <div class="blip-reaction-summary-popover-names">{tooltipText}</div>
                    </PopoverContent>
                  </Popover>
                </Show>
              </li>
            )
          }}
        </For>
      </ul>
    </Show>
  )
}
