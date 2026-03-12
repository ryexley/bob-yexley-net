import { JSX, splitProps } from "solid-js"
import { TextField } from "@kobalte/core/text-field"
import { clsx as cx, isNotEmpty } from "@/util"
import "./input.css"

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  errorMessage?: string
  hint?: string
  containerClass?: string
  inputClass?: string
}

export function Input(props: InputProps) {
  const [local, attrs] = splitProps(props, [
    "label",
    "errorMessage",
    "hint",
    "containerClass",
    "inputClass",
  ])

  return (
    <TextField class={cx("input-field", local.containerClass)}>
      {isNotEmpty(local.label) ? (
        <TextField.Label class="input-label">
          {local.label}
        </TextField.Label>
      ) : null}
      <TextField.Input
        class={cx("input-control", local.inputClass)}
        {...attrs}
      />
      {isNotEmpty(local.hint) ? (
        <TextField.Description class="input-hint">
          {local.hint}
        </TextField.Description>
      ) : null}
      {isNotEmpty(local.errorMessage) ? (
        <TextField.ErrorMessage class="input-error-message">
          {local.errorMessage}
        </TextField.ErrorMessage>
      ) : null}
    </TextField>
  )
}
