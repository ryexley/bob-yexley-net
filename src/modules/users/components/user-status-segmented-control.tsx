import { For, Show, createMemo } from "solid-js"
import { SegmentedControl } from "@kobalte/core/segmented-control"
import type { UserStatusFilter } from "@/modules/users/data/types"
import { ptr } from "@/i18n"
import { clsx as cx } from "@/util"
import "./user-status-segmented-control.css"

const tr = ptr("users.shared.statuses")

type UserStatusSegmentedControlProps = {
  value: UserStatusFilter
  onChange: (value: UserStatusFilter) => void
  includeAll?: boolean
  label?: string
  disabled?: boolean
  class?: string
}

export function UserStatusSegmentedControl(props: UserStatusSegmentedControlProps) {
  const options = createMemo(() => {
    const values: UserStatusFilter[] = props.includeAll
      ? ["all", "pending", "active", "locked"]
      : ["pending", "active", "locked"]

    return values.map(value => ({
      value,
      label: tr(value),
    }))
  })

  return (
    <SegmentedControl
      value={props.value}
      onChange={value => props.onChange(value as UserStatusFilter)}
      disabled={props.disabled}
      class={cx("user-status-segmented-control", props.class)}>
      <Show when={props.label}>
        <SegmentedControl.Label class="user-status-segmented-control-label">
          {props.label}
        </SegmentedControl.Label>
      </Show>
      <div
        role="presentation"
        class="user-status-segmented-control-track">
        <For each={options()}>
          {option => (
            <SegmentedControl.Item
              value={option.value}
              class="user-status-segmented-control-item">
              <SegmentedControl.ItemInput />
              <SegmentedControl.ItemLabel class="user-status-segmented-control-item-label">
                {option.label}
              </SegmentedControl.ItemLabel>
            </SegmentedControl.Item>
          )}
        </For>
      </div>
    </SegmentedControl>
  )
}
