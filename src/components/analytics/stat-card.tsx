import { Show } from "solid-js"
import { clsx as cx } from "@/util"
import "./stat-card.css"

type StatCardProps = {
  label: string
  value: string | number
  delta?: number | null
  class?: string
}

function formatDelta(delta: number) {
  const rounded = Math.round(delta * 10) / 10
  const prefix = rounded > 0 ? "+" : ""
  return `${prefix}${rounded}%`
}

export function StatCard(props: StatCardProps) {
  const deltaDirection = () => {
    const value = props.delta
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null
    }

    if (value > 0) {
      return "up"
    }

    if (value < 0) {
      return "down"
    }

    return "flat"
  }

  return (
    <article class={cx("stat-card", props.class)}>
      <p class="label">{props.label}</p>
      <p class="value">{props.value}</p>
      <Show when={deltaDirection()}>
        {direction => (
          <p
            class="delta"
            data-direction={direction()}>
            {formatDelta(props.delta ?? 0)}
          </p>
        )}
      </Show>
    </article>
  )
}
