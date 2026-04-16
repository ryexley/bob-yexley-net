import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
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
  class?: string
}

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_THRESHOLD_PX = 12
const MOBILE_MAX_WIDTH = 768
const formatDisplayNames = (names: string[]) => names.join(", ")

export function BlipReactionSummary(props: BlipReactionSummaryProps) {
  const auth = useAuth()
  const viewport = useViewport()
  const reactions = () => props.reactions ?? []
  const [hasMounted, setHasMounted] = createSignal(false)
  const [openPopoverEmoji, setOpenPopoverEmoji] = createSignal<string | null>(null)
  const isMobile = createMemo(() => viewport.width() <= MOBILE_MAX_WIDTH)
  const canViewReactionNames = createMemo(() => auth.isAuthenticated())
  const canUseLongPressPopover = createMemo(() => isMobile() && canViewReactionNames())
  const longPressTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const longPressOrigins = new Map<string, { x: number; y: number }>()
  let longPressOpenedEmoji: string | null = null

  onMount(() => {
    setHasMounted(true)
  })

  const clearLongPressTimeout = (emoji?: string) => {
    if (emoji) {
      const timeoutId = longPressTimeouts.get(emoji)
      if (timeoutId) {
        clearTimeout(timeoutId)
        longPressTimeouts.delete(emoji)
      }
      longPressOrigins.delete(emoji)
      return
    }

    for (const timeoutId of longPressTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    longPressTimeouts.clear()
    longPressOrigins.clear()
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

    clearLongPressTimeout(emoji)
    longPressOpenedEmoji = null
    longPressOrigins.set(emoji, {
      x: touch.clientX,
      y: touch.clientY,
    })
    const timeoutId = setTimeout(() => {
      longPressOpenedEmoji = emoji
      openReactionPopover(emoji)
      clearLongPressTimeout(emoji)
    }, LONG_PRESS_MS)
    longPressTimeouts.set(emoji, timeoutId)
  }

  const maybeCancelLongPressForMovement = (emoji: string, touch: Touch) => {
    const origin = longPressOrigins.get(emoji)
    if (!origin) {
      return
    }

    const movedBeyondThreshold =
      Math.abs(touch.clientX - origin.x) > LONG_PRESS_MOVE_THRESHOLD_PX ||
      Math.abs(touch.clientY - origin.y) > LONG_PRESS_MOVE_THRESHOLD_PX

    if (movedBeyondThreshold) {
      clearLongPressTimeout(emoji)
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
    clearLongPressTimeout(emoji)
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
    longPressOpenedEmoji = null
  })

  return (
    <Show when={reactions().length > 0}>
      <ul class={cx("blip-reaction-summary-list", props.class)} aria-label="Reactions">
        <For each={reactions()}>
          {reaction => {
            const displayNames = createMemo(() => getReactionNames(reaction))
            const tooltipText = createMemo(() => formatDisplayNames(displayNames()))
            // Desktop tooltip markup is hydration-safe now that viewport state is
            // aligned between SSR and the initial client render.
            const showDesktopTooltip = createMemo(
              () => !isMobile() && tooltipText().length > 0,
            )
            const allowLongPressPopover = createMemo(
              () => hasMounted() && canUseLongPressPopover() && tooltipText().length > 0,
            )
            const canToggle = createMemo(() => Boolean(props.onToggleReaction))
            const renderDetailsContent = () => (
              <div class="blip-reaction-summary-tooltip-body">
                <div class="blip-reaction-summary-tooltip-emoji" aria-hidden="true">
                  {reaction.emoji}
                </div>
                <div class="blip-reaction-summary-tooltip-names">{tooltipText()}</div>
              </div>
            )
            const pillClass = createMemo(() =>
              cx(
                "blip-reaction-summary-pill",
                canToggle() && "blip-reaction-summary-button",
                reaction.reacted_by_current_user && "reacted",
              ),
            )
            const renderChipContent = () => (
              <>
                <span class="emoji" aria-hidden="true">{reaction.emoji}</span>
                <span class="count">{reaction.count}</span>
              </>
            )
            const desktopTriggerProps = createMemo(() =>
              canToggle()
                ? {
                    type: "button" as const,
                    disabled: props.busy,
                    "aria-label": `${reaction.reacted_by_current_user ? "Remove" : "Add"} ${reaction.emoji} reaction`,
                    onClick: (event: MouseEvent) =>
                      handleReactionClick(event, reaction.emoji),
                  }
                : undefined,
            )
            const desktopTrigger = () =>
              canToggle() ? (
                <button class={pillClass()} {...desktopTriggerProps()}>
                  {renderChipContent()}
                </button>
              ) : (
                <span class={pillClass()}>{renderChipContent()}</span>
              )
            const desktopChip = () =>
              showDesktopTooltip() ? (
                <Tooltip
                  content={renderDetailsContent()}
                  contentClass="blip-reaction-summary-tooltip"
                  triggerAs={canToggle() ? "button" : "span"}
                  triggerClass={pillClass()}
                  triggerProps={desktopTriggerProps()}>
                  {renderChipContent()}
                </Tooltip>
              ) : (
                desktopTrigger()
              )

            const chip = () =>
              canToggle() ? (
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
                    handleTouchStart(event, reaction.emoji, allowLongPressPopover())
                  }
                  onTouchMove={event => {
                    if (!allowLongPressPopover()) {
                      return
                    }

                    const touch = event.touches[0]
                    if (touch) {
                      maybeCancelLongPressForMovement(reaction.emoji, touch)
                    }
                  }}
                  onTouchEnd={event =>
                    handleTouchEnd(event, reaction.emoji, canToggle(), allowLongPressPopover())
                  }
                  onTouchCancel={() => clearLongPressTimeout(reaction.emoji)}
                  onContextMenu={event => {
                    if (allowLongPressPopover()) {
                      event.preventDefault()
                      openReactionPopover(reaction.emoji)
                    }
                  }}>
                  {renderChipContent()}
                </button>
              ) : (
                <span
                  class="blip-reaction-summary-pill"
                  classList={{
                    reacted: reaction.reacted_by_current_user,
                  }}
                  onTouchStart={event =>
                    handleTouchStart(event, reaction.emoji, allowLongPressPopover())
                  }
                  onTouchMove={event => {
                    if (!allowLongPressPopover()) {
                      return
                    }

                    const touch = event.touches[0]
                    if (touch) {
                      maybeCancelLongPressForMovement(reaction.emoji, touch)
                    }
                  }}
                  onTouchEnd={event =>
                    handleTouchEnd(event, reaction.emoji, false, allowLongPressPopover())
                  }
                  onTouchCancel={() => clearLongPressTimeout(reaction.emoji)}
                  onContextMenu={event => {
                    if (allowLongPressPopover()) {
                      event.preventDefault()
                      openReactionPopover(reaction.emoji)
                    }
                  }}>
                  {renderChipContent()}
                </span>
              )

            return (
              <li class="blip-reaction-summary-item">
                {allowLongPressPopover() ? (
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
                    <PopoverAnchor as="span">{chip()}</PopoverAnchor>
                    <PopoverContent
                      class="blip-reaction-summary-popover"
                      role="dialog"
                      aria-label={`Reactions for ${reaction.emoji}`}>
                      <div class="blip-reaction-summary-popover-emoji" aria-hidden="true">
                        {reaction.emoji}
                      </div>
                      <div class="blip-reaction-summary-popover-names">{tooltipText()}</div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  desktopChip()
                )}
              </li>
            )
          }}
        </For>
      </ul>
    </Show>
  )
}
