import { For, Show } from "solid-js"
import { clsx as cx } from "@/util"
import "./device-breakdown.css"

type DeviceBreakdownProps = {
  mobile: number
  tablet: number
  desktop: number
  class?: string
}

export function DeviceBreakdown(props: DeviceBreakdownProps) {
  const items = () => [
    { key: "mobile", label: "Mobile", value: props.mobile },
    { key: "tablet", label: "Tablet", value: props.tablet },
    { key: "desktop", label: "Desktop", value: props.desktop },
  ]

  const total = () => items().reduce((sum, item) => sum + item.value, 0)

  return (
    <div class={cx("device-breakdown", props.class)}>
      <Show
        when={total() > 0}
        fallback={<p class="empty">No device data for this period.</p>}>
        <For each={items()}>
          {item => {
            const percentage = () =>
              total() === 0 ? 0 : Math.round((item.value / total()) * 100)

            return (
              <div
                class="item"
                data-device={item.key}>
                <div class="meta">
                  <span class="label">{item.label}</span>
                  <span class="value">
                    {item.value.toLocaleString()} ({percentage()}%)
                  </span>
                </div>
                <div class="track">
                  <div
                    class="fill"
                    style={{ width: `${Math.max(percentage(), 4)}%` }}
                  />
                </div>
              </div>
            )
          }}
        </For>
      </Show>
    </div>
  )
}
