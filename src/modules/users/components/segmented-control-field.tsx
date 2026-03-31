import { For, Show } from "solid-js"
import { SegmentedControl } from "@kobalte/core/segmented-control"
import { clsx as cx } from "@/util"
import "./segmented-control-field.css"

export type SegmentedControlFieldOption<T extends string> = {
  value: T
  label: string
  tone?: string
}

type SegmentedControlFieldProps<T extends string> = {
  value: T
  options: SegmentedControlFieldOption<T>[]
  onChange: (value: T) => void
  label?: string
  disabled?: boolean
  class?: string
}

export function SegmentedControlField<T extends string>(
  props: SegmentedControlFieldProps<T>,
) {
  return (
    <SegmentedControl
      value={props.value}
      onChange={value => props.onChange(value as T)}
      disabled={props.disabled}
      class={cx("segmented-control-field", props.class)}>
      <Show when={props.label}>
        <SegmentedControl.Label class="segmented-control-field-label">
          {props.label}
        </SegmentedControl.Label>
      </Show>
      <div
        role="presentation"
        class="segmented-control-field-track">
        <For each={props.options}>
          {option => (
            <SegmentedControl.Item
              value={option.value}
              data-tone={option.tone ?? option.value}
              class="segmented-control-field-item">
              <SegmentedControl.ItemInput />
              <SegmentedControl.ItemLabel class="segmented-control-field-item-label">
                {option.label}
              </SegmentedControl.ItemLabel>
            </SegmentedControl.Item>
          )}
        </For>
      </div>
    </SegmentedControl>
  )
}
