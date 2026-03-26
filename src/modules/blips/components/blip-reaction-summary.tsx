import { For, Show } from "solid-js"
import { Tooltip } from "@/components/tooltip"
import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"
import "./blip-reaction-summary.css"

type BlipReactionSummaryProps = {
  reactions?: BlipReactionSummary[]
  onToggleReaction?: (emoji: string) => void
  busy?: boolean
}

const formatDisplayNames = (names: string[]) => names.join(", ")

export function BlipReactionSummary(props: BlipReactionSummaryProps) {
  const reactions = () => props.reactions ?? []

  return (
    <Show when={reactions().length > 0}>
      <ul class="blip-reaction-summary-list" aria-label="Reactions">
        <For each={reactions()}>
          {reaction => {
            const tooltipContent = formatDisplayNames(reaction.display_names)
            return (
              <li>
                <Tooltip
                  content={tooltipContent}
                  disabled={tooltipContent.length === 0}
                  contentClass="blip-reaction-summary-tooltip">
                  <Show
                    when={props.onToggleReaction}
                    fallback={
                      <span
                        class="blip-reaction-summary-pill"
                        classList={{
                          reacted: reaction.reacted_by_current_user,
                        }}>
                        <span class="emoji" aria-hidden="true">{reaction.emoji}</span>
                        <span class="count">{reaction.count}</span>
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
                      onClick={() => props.onToggleReaction?.(reaction.emoji)}>
                      <span class="emoji" aria-hidden="true">{reaction.emoji}</span>
                      <span class="count">{reaction.count}</span>
                    </button>
                  </Show>
                </Tooltip>
              </li>
            )
          }}
        </For>
      </ul>
    </Show>
  )
}
