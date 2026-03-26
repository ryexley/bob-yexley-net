import { createMemo, For, Show } from "solid-js"
import { Icon } from "@/components/icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/popover"
import { REACTION_EMOJI_SET } from "@/lib/data/reactions-emoji-set"
import { clsx as cx } from "@/util"
import "./reaction-picker.css"

type ReactionPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTriggerClick: (event: MouseEvent) => void
  onToggleReaction: (emoji: string) => void
  activeEmojis: string[]
  triggerAriaLabel: string
  limitReached?: boolean
  busy?: boolean
}

export function ReactionPicker(props: ReactionPickerProps) {
  const activeEmojiSet = createMemo(() => new Set(props.activeEmojis))

  const handlePointerDownOutside = (
    event: Event & { detail?: { originalEvent?: Event } },
  ) => {
    const closePicker = props.onOpenChange

    // Prevent tap-through so dismissing the picker doesn't also activate
    // the blip underneath during the same gesture.
    event.detail?.originalEvent?.preventDefault?.()
    event.detail?.originalEvent?.stopPropagation?.()
    event.preventDefault()
    queueMicrotask(() => closePicker(false))
  }

  return (
    <Popover
      open={props.open}
      onOpenChange={props.onOpenChange}
      gutter={4}
      placement="top"
      flip
      shift={8}>
      <PopoverTrigger
        type="button"
        class={cx("reaction-trigger", {
          "limit-reached": props.limitReached,
        })}
        aria-label={props.triggerAriaLabel}
        aria-busy={props.busy ? "true" : "false"}
        aria-disabled={props.limitReached ? "true" : undefined}
        disabled={props.busy}
        onClick={event => props.onTriggerClick(event)}>
        <Icon name="add_reaction" />
      </PopoverTrigger>
      <Show when={!props.limitReached}>
        <PopoverContent
          class="reaction-picker-content"
          disableOutsidePointerEvents
          onPointerDownOutside={handlePointerDownOutside}>
          <div class="reaction-picker-shell">
            <div class="reaction-picker-body">
              <div class="reaction-picker-grid">
                <For each={REACTION_EMOJI_SET}>
                  {emoji => (
                    <button
                      type="button"
                      class={cx("reaction-picker-emoji", {
                        active: activeEmojiSet().has(emoji),
                      })}
                      onClick={event => {
                        event.stopPropagation()
                        props.onToggleReaction(emoji)
                      }}
                      disabled={props.busy}
                      aria-label={emoji}>
                      <span>{emoji}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
            <div class="reaction-picker-note" aria-label="Reaction limit">
              Limit 3
            </div>
          </div>
        </PopoverContent>
      </Show>
    </Popover>
  )
}
