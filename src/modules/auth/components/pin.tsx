import {
  For,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  splitProps,
} from "solid-js"
import { Icon } from "@/components/icon"
import { clsx as cx } from "@/util"
import "./pin.css"

const PIN_LENGTH = 6

type PinProps = {
  label?: string
  masked?: boolean
  showMaskToggle?: boolean
  value?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  id?: string
  name?: string
  class?: string
  inputsClass?: string
  inputClass?: string
  "aria-label"?: string
}

const normalizePin = (value: string | undefined) =>
  (value ?? "").replace(/\D/g, "").slice(0, PIN_LENGTH)

export function Pin(props: PinProps) {
  const [local, attrs] = splitProps(props, [
    "label",
    "masked",
    "showMaskToggle",
    "value",
    "onChange",
    "onComplete",
    "disabled",
    "required",
    "autoFocus",
    "id",
    "name",
    "class",
    "inputsClass",
    "inputClass",
  ])
  const baseId = createMemo(() => local.id || `pin-${createUniqueId()}`)
  const [isMasked, setIsMasked] = createSignal(true)
  const [internalValue, setInternalValue] = createSignal("")
  createEffect(() => {
    setIsMasked(local.masked ?? true)
  })
  const pinValue = createMemo(() => normalizePin(local.value ?? internalValue()))
  const pinDigits = createMemo(() => {
    const value = pinValue()
    return Array.from({ length: PIN_LENGTH }, (_, idx) => value[idx] ?? "")
  })
  let inputRefs: Array<HTMLInputElement | undefined> = []

  const emitValue = (nextValue: string) => {
    const normalized = normalizePin(nextValue)

    if (local.value === undefined) {
      setInternalValue(normalized)
    }

    local.onChange?.(normalized)

    if (normalized.length === PIN_LENGTH) {
      local.onComplete?.(normalized)
    }
  }

  const focusInput = (index: number) => {
    const input = inputRefs[index]
    if (!input) {
      return
    }

    input.focus()
    input.select()
  }

  const focusNextFocusable = (currentInput: HTMLInputElement) => {
    const searchRoot = (currentInput.form ?? currentInput.ownerDocument) as
      | HTMLFormElement
      | Document
    const selector = [
      "input",
      "textarea",
      "select",
      "button",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ")
    const focusable = Array.from(
      searchRoot.querySelectorAll<HTMLElement>(selector),
    ).filter(element => {
      if (element.hasAttribute("disabled")) {
        return false
      }
      if (element.getAttribute("aria-hidden") === "true") {
        return false
      }
      return element.tabIndex >= 0
    })

    const currentIndex = focusable.indexOf(currentInput)
    if (currentIndex < 0) {
      currentInput.blur()
      return
    }

    const nextFocusable = focusable[currentIndex + 1]
    if (!nextFocusable) {
      currentInput.blur()
      return
    }

    nextFocusable.focus()
    if (
      nextFocusable instanceof HTMLInputElement ||
      nextFocusable instanceof HTMLTextAreaElement
    ) {
      nextFocusable.select?.()
    }
  }

  const setDigitAt = (index: number, digit: string) => {
    const nextDigits = [...pinDigits()]
    nextDigits[index] = digit
    emitValue(nextDigits.join(""))
  }

  const handleInput = (index: number, event: InputEvent & { currentTarget: HTMLInputElement }) => {
    const nextDigit = (event.currentTarget.value.match(/\d/g) ?? []).at(-1) ?? ""
    setDigitAt(index, nextDigit)

    if (!nextDigit) {
      return
    }

    if (index < PIN_LENGTH - 1) {
      focusInput(index + 1)
      return
    }

    focusNextFocusable(event.currentTarget)
  }

  const handleBackspace = (
    index: number,
    event: KeyboardEvent & { currentTarget: HTMLInputElement },
  ) => {
    if (event.key !== "Backspace") {
      return
    }

    event.preventDefault()

    const currentDigit = pinDigits()[index]
    if (currentDigit) {
      setDigitAt(index, "")
      if (index > 0) {
        focusInput(index - 1)
      }
      return
    }

    if (index > 0) {
      setDigitAt(index - 1, "")
      focusInput(index - 1)
    }
  }

  const handlePaste = (event: ClipboardEvent) => {
    event.preventDefault()
    const pastedDigits = normalizePin(event.clipboardData?.getData("text") ?? "")
    if (!pastedDigits) {
      return
    }

    emitValue(pastedDigits)
    if (pastedDigits.length >= PIN_LENGTH) {
      const lastInput = inputRefs[PIN_LENGTH - 1]
      if (lastInput) {
        focusNextFocusable(lastInput)
      }
      return
    }

    focusInput(Math.min(pastedDigits.length, PIN_LENGTH) - 1)
  }

  return (
    <div class={cx("pin-field", local.class)}>
      {local.label ? (
        <div class="pin-label-row">
          <label
            for={`${baseId()}-0`}
            class="pin-label">
            {local.label}
          </label>
          {local.showMaskToggle ?? true ? (
            <button
              type="button"
              class={cx("pin-mask-toggle", {
                "is-active": !isMasked(),
              })}
              tabindex={-1}
              aria-label={isMasked() ? "Show PIN" : "Hide PIN"}
              onClick={() => setIsMasked(previous => !previous)}>
              <Icon name={isMasked() ? "visibility" : "visibility_off"} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        class={cx("pin-inputs", local.inputsClass)}
        onPaste={handlePaste}>
        <For each={pinDigits()}>
          {(digit, index) => (
            <input
              {...attrs}
              id={`${baseId()}-${index()}`}
              ref={element => {
                inputRefs[index()] = element
              }}
              type={isMasked() ? "password" : "number"}
              inputmode="numeric"
              min="0"
              max="9"
              step="1"
              value={digit}
              name={local.name}
              required={local.required}
              disabled={local.disabled}
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck={false}
              aria-label={`PIN digit ${index() + 1}`}
              class={cx("pin-input", local.inputClass)}
              onInput={event => handleInput(index(), event)}
              onKeyDown={event => handleBackspace(index(), event)}
              onFocus={event => event.currentTarget.select()}
              autofocus={local.autoFocus && index() === 0}
            />
          )}
        </For>
      </div>
    </div>
  )
}
