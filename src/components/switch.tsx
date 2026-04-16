import { Show, splitProps, type JSXElement } from "solid-js"
import { Switch as SwitchPrimitive } from "@kobalte/core/switch"
import { cx, isNotEmpty } from "@/util"
import "./switch.css"

type SwitchProps = {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  label?: JSXElement
  hint?: JSXElement
  errorMessage?: JSXElement
  endContent?: JSXElement
  name?: string
  value?: string
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  containerClass?: string
  controlClass?: string
  thumbClass?: string
  "aria-label"?: string
}

export function Switch(props: SwitchProps) {
  const [local] = splitProps(props, [
    "checked",
    "defaultChecked",
    "onChange",
    "label",
    "hint",
    "errorMessage",
    "endContent",
    "name",
    "value",
    "disabled",
    "required",
    "readOnly",
    "containerClass",
    "controlClass",
    "thumbClass",
    "aria-label",
  ])

  return (
    <SwitchPrimitive
      checked={local.checked}
      defaultChecked={local.defaultChecked}
      onChange={local.onChange}
      name={local.name}
      value={local.value}
      disabled={local.disabled}
      required={local.required}
      readOnly={local.readOnly}
      class={cx("switch-field", local.containerClass)}>
      <div class="switch-main-row">
        <Show when={isNotEmpty(local.label)}>
          <SwitchPrimitive.Label class="switch-label">
            {local.label}
          </SwitchPrimitive.Label>
        </Show>
        <div class="switch-control-row">
          <SwitchPrimitive.Input aria-label={local["aria-label"]} />
          <SwitchPrimitive.Control class={cx("switch-control", local.controlClass)}>
            <SwitchPrimitive.Thumb class={cx("switch-thumb", local.thumbClass)} />
          </SwitchPrimitive.Control>
          <Show when={local.endContent}>
            <div class="switch-end-content">{local.endContent}</div>
          </Show>
        </div>
      </div>
      <Show when={isNotEmpty(local.hint)}>
        <SwitchPrimitive.Description class="switch-hint">
          {local.hint}
        </SwitchPrimitive.Description>
      </Show>
      <Show when={isNotEmpty(local.errorMessage)}>
        <SwitchPrimitive.ErrorMessage class="switch-error-message">
          {local.errorMessage}
        </SwitchPrimitive.ErrorMessage>
      </Show>
    </SwitchPrimitive>
  )
}
