import { For, Show } from "solid-js"
import { clsx as cx } from "@/util"
import "./ranked-list.css"

export type RankedListItem = {
  label: string
  value: number
  secondaryValue?: number
  detail?: string
}

type RankedListProps = {
  items: RankedListItem[]
  emptyLabel?: string
  class?: string
  valueLabel?: string
  secondaryValueLabel?: string
}

export function RankedList(props: RankedListProps) {
  const maxValue = () =>
    Math.max(...props.items.map(item => item.value), 1)

  return (
    <div class={cx("ranked-list", props.class)}>
      <Show
        when={props.items.length > 0}
        fallback={
          <p class="empty">{props.emptyLabel ?? "No data for this period."}</p>
        }>
        <For each={props.items}>
          {item => (
            <div class="row">
              <div class="meta">
                <div class="label-group">
                  <span
                    class="label"
                    title={item.label}>
                    {item.label}
                  </span>
                  <Show when={item.detail}>
                    {detail => (
                      <span
                        class="detail"
                        title={detail()}>
                        {detail()}
                      </span>
                    )}
                  </Show>
                </div>
                <span class="value">
                  {item.value.toLocaleString()}
                  <Show when={item.secondaryValue !== undefined}>
                    <span class="secondary">
                      {props.secondaryValueLabel ?? "views"}:{" "}
                      {item.secondaryValue?.toLocaleString()}
                    </span>
                  </Show>
                </span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  style={{
                    width: `${Math.max((item.value / maxValue()) * 100, 4)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}
