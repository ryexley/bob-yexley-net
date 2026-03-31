import { Show, createMemo, splitProps } from "solid-js"
import { Select as SelectPrimitive } from "@kobalte/core/select"
import { Icon } from "@/components/icon"
import { cx, isNotEmpty } from "@/util"
import "./select.css"

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectProps = {
  options: SelectOption[]
  value?: string | null
  defaultValue?: string
  onChange?: (value: string | null) => void
  placeholder?: string
  label?: string
  hint?: string
  errorMessage?: string
  name?: string
  disabled?: boolean
  required?: boolean
  containerClass?: string
  triggerClass?: string
  contentClass?: string
  itemClass?: string
  "aria-label"?: string
}

export function Select(props: SelectProps) {
  const [local] = splitProps(props, [
    "options",
    "value",
    "defaultValue",
    "onChange",
    "placeholder",
    "label",
    "hint",
    "errorMessage",
    "name",
    "disabled",
    "required",
    "containerClass",
    "triggerClass",
    "contentClass",
    "itemClass",
    "aria-label",
  ])

  const selectedOption = createMemo(() =>
    local.options.find(option => option.value === local.value) ?? null,
  )
  const defaultSelectedOption = createMemo(() =>
    local.options.find(option => option.value === local.defaultValue),
  )

  return (
    <SelectPrimitive
      options={local.options}
      optionValue="value"
      optionTextValue="label"
      optionDisabled="disabled"
      value={local.value !== undefined ? selectedOption() : undefined}
      defaultValue={local.defaultValue !== undefined ? defaultSelectedOption() : undefined}
      onChange={option => local.onChange?.(option?.value ?? null)}
      placeholder={local.placeholder}
      name={local.name}
      disabled={local.disabled}
      required={local.required}
      class={cx("select-field", local.containerClass)}
      itemComponent={props => (
        <SelectPrimitive.Item
          item={props.item}
          class={cx("select-item", local.itemClass)}>
          <span class="select-item-label">{props.item.rawValue.label}</span>
          <span class="select-item-indicator" aria-hidden="true">
            <Icon name="check" />
          </span>
        </SelectPrimitive.Item>
      )}>
      <Show when={isNotEmpty(local.label)}>
        <SelectPrimitive.Label class="select-label">
          {local.label}
        </SelectPrimitive.Label>
      </Show>
      <SelectPrimitive.HiddenSelect />
      <SelectPrimitive.Trigger
        class={cx("select-trigger", local.triggerClass)}
        aria-label={local["aria-label"]}>
        <SelectPrimitive.Value<SelectOption> class="select-value">
          {state => state.selectedOption().label}
        </SelectPrimitive.Value>
        <span class="select-trigger-icon" aria-hidden="true">
          <Icon name="expand_more" />
        </span>
      </SelectPrimitive.Trigger>
      <Show when={isNotEmpty(local.hint)}>
        <div class="select-hint">{local.hint}</div>
      </Show>
      <Show when={isNotEmpty(local.errorMessage)}>
        <div class="select-error-message">{local.errorMessage}</div>
      </Show>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content class={cx("select-content", local.contentClass)}>
          <SelectPrimitive.Listbox class="select-listbox" />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive>
  )
}
