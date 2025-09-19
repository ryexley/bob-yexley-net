import { JSX, splitProps } from "solid-js"
import { TextField } from "@kobalte/core/text-field"
import { cn } from "@/lib/util"
import { isNotEmpty } from "@/util"

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
    <TextField class={cn("flex flex-col w-full", local.containerClass)}>
      {isNotEmpty(local.label) ? (
        <TextField.Label class="text-[var(--colors-mono-10)] text-sm font-medium select-none">
          {local.label}
        </TextField.Label>
      ) : null}
      <TextField.Input
        class={cn(
          "inline-flex w-full rounded-md px-3 py-1.5 text-base outline-none bg-[var(--colors-mono-02)] border border-[var(--colors-mono-07)] text-[var(--colors-text-base)] transition-colors duration-250 hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 data-[invalid]:border-red-500 data-[invalid]:text-red-500 placeholder:text-slate-600",
          local.inputClass,
        )}
        {...attrs}
      />
      {isNotEmpty(local.hint) ? (
        <TextField.Description class="text-slate-700 text-xs select-none">
          {local.hint}
        </TextField.Description>
      ) : null}
      {isNotEmpty(local.errorMessage) ? (
        <TextField.ErrorMessage class="text-red-500 text-xs select-none">
          {local.errorMessage}
        </TextField.ErrorMessage>
      ) : null}
    </TextField>
  )
}
