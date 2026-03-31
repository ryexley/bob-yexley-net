import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  onCleanup,
  splitProps,
} from "solid-js"
import {
  Combobox as ComboboxPrimitive,
  type ComboboxRootProps,
} from "@kobalte/core/combobox"
import { Icon } from "@/components/icon"
import { cx, isNotEmpty } from "@/util"
import "./combobox.css"

export type ComboboxProps<Option, OptGroup = never> = Omit<
  ComboboxRootProps<Option, OptGroup>,
  "itemComponent" | "sectionComponent"
> & {
  class?: string
  label?: string
  hint?: string
  errorMessage?: string
  containerClass?: string
  controlClass?: string
  inputClass?: string
  triggerClass?: string
  contentClass?: string
  itemClass?: string
  sectionClass?: string
  showItemIndicator?: boolean
  chipListClass?: string
  chipClass?: string
  chipRemoveButtonClass?: string
  portalMount?: HTMLElement
  renderItem?: (option: Option) => JSX.Element
  renderSection?: (section: OptGroup) => JSX.Element
  renderChip?: (
    option: Option,
    helpers: { remove: () => void; label: string },
  ) => JSX.Element
  onInputChange?: (value: string) => void
  openOnFocus?: boolean
  freeSolo?: boolean
  onCreateOption?: (inputValue: string) => Option | null | undefined
  onOptionsChange?: (options: Option[]) => void
  isOptionEqual?: (left: Option, right: Option) => boolean
  "aria-label"?: string
}

function getOptionText<Option>(
  option: Exclude<Option, null>,
  accessor:
    | keyof Exclude<Option, null>
    | ((option: Exclude<Option, null>) => string | number)
    | undefined,
) {
  if (typeof accessor === "function") {
    return String(accessor(option))
  }

  if (typeof accessor === "string") {
    const value = (option as Record<string, unknown>)[accessor]

    if (value != null) {
      return String(value)
    }
  }

  if (typeof option === "string" || typeof option === "number") {
    return String(option)
  }

  if (typeof option === "object" && option !== null) {
    if ("label" in option && option.label != null) {
      return String(option.label)
    }

    if ("name" in option && option.name != null) {
      return String(option.name)
    }
  }

  return ""
}

function getSectionText<OptGroup>(section: Exclude<OptGroup, null>) {
  if (typeof section === "string" || typeof section === "number") {
    return String(section)
  }

  if (typeof section === "object" && section !== null) {
    if ("label" in section && section.label != null) {
      return String(section.label)
    }

    if ("name" in section && section.name != null) {
      return String(section.name)
    }
  }

  return ""
}

type MultiSelectControlState<Option> = {
  selectedOptions: () => Option[]
  remove: (option: Option) => void
  clear: () => void
}

type SingleSelectControlState<Option> = MultiSelectControlState<Option> & {
  selectedOption?: () => Option | null | undefined
}

export function Combobox<Option, OptGroup = never>(
  props: ComboboxProps<Option, OptGroup>,
) {
  const [local, attrs] = splitProps(props, [
    "class",
    "label",
    "hint",
    "errorMessage",
    "containerClass",
    "controlClass",
    "inputClass",
    "triggerClass",
    "contentClass",
    "itemClass",
    "sectionClass",
    "showItemIndicator",
    "chipListClass",
    "chipClass",
    "chipRemoveButtonClass",
    "portalMount",
    "renderItem",
    "renderSection",
    "renderChip",
    "onInputChange",
    "openOnFocus",
    "freeSolo",
    "onCreateOption",
    "onOptionsChange",
    "isOptionEqual",
    "aria-label",
    "multiple",
    "optionLabel",
    "optionTextValue",
    "optionValue",
  ])

  const labelAccessor = () =>
    local.optionLabel ?? local.optionTextValue ?? local.optionValue
  const rootProps = attrs as ComboboxRootProps<Option, OptGroup>
  const normalize = (value: string) => value.trim().toLowerCase()
  const toArray = <T,>(value: T | T[] | undefined | null): T[] => {
    if (value == null) {
      return []
    }

    return Array.isArray(value) ? value : [value]
  }
  const resolveMaybeAccessor = <T,>(value: T | (() => T) | undefined) =>
    typeof value === "function" ? (value as () => T)() : value
  const getLabel = (option: Option) =>
    getOptionText(option as Exclude<Option, null>, labelAccessor())
  const getOptionIdentity = (option: Option) => {
    const identityAccessor = local.optionValue ?? labelAccessor()
    return normalize(
      getOptionText(option as Exclude<Option, null>, identityAccessor),
    )
  }
  const areOptionsEqual = (left: Option, right: Option) => {
    if (local.isOptionEqual) {
      return local.isOptionEqual(left, right)
    }

    return getOptionIdentity(left) === getOptionIdentity(right)
  }
  const [newOptions, setNewOptions] = createSignal<Option[]>([])
  const [inputQuery, setInputQuery] = createSignal("")
  const [listboxRef, setListboxRef] = createSignal<HTMLElement | undefined>()
  const [isListboxScrollable, setIsListboxScrollable] = createSignal(false)
  const [showScrollHintTop, setShowScrollHintTop] = createSignal(false)
  const [showScrollHintBottom, setShowScrollHintBottom] = createSignal(false)
  const SCROLL_HINT_EPSILON = 1
  let suppressOpenOnNextInputFocus = false
  const mergedOptions = createMemo(() => {
    const baseOptions = toArray(
      resolveMaybeAccessor(
        (
          rootProps as {
            options?: Option[] | (() => Option[] | undefined) | undefined
          }
        ).options,
      ),
    )

    if (!local.freeSolo) {
      return baseOptions
    }

    const merged = [...baseOptions]
    for (const option of newOptions()) {
      if (!merged.some(existing => areOptionsEqual(existing, option))) {
        merged.push(option)
      }
    }

    return merged
  })
  const primitiveProps = createMemo(
    () =>
      ({
        ...rootProps,
        options: mergedOptions(),
        onInputChange: (value: string) => {
          setInputQuery(value)
          local.onInputChange?.(value)
        },
        multiple: local.multiple,
        optionValue: local.optionValue,
        optionLabel: local.optionLabel,
        optionTextValue: local.optionTextValue,
      }) as ComboboxRootProps<Option, OptGroup>,
  )
  const getOptionSearchText = (option: Option) =>
    getOptionText(
      option as Exclude<Option, null>,
      local.optionTextValue ?? labelAccessor(),
    )
  const findExactInputMatch = (inputValue: string) => {
    const normalizedInput = normalize(inputValue)
    if (!normalizedInput) {
      return null
    }

    return (
      mergedOptions().find(
        option => normalize(getOptionSearchText(option)) === normalizedInput,
      ) ?? null
    )
  }
  const shouldAutoHighlightOption = (option: Option) =>
    normalize(getOptionSearchText(option)) === normalize(inputQuery())
  const clearInputValue = (target: EventTarget | null) => {
    if (!(target instanceof HTMLInputElement)) {
      return
    }

    target.value = ""
    target.dispatchEvent(new Event("input", { bubbles: true }))
  }
  const openOptionsOnInputFocus = (event: FocusEvent) => {
    if (!local.openOnFocus) {
      return
    }

    if (suppressOpenOnNextInputFocus) {
      suppressOpenOnNextInputFocus = false
      return
    }

    const target = event.currentTarget
    if (!(target instanceof HTMLInputElement)) {
      return
    }

    if (target.hasAttribute("disabled") || target.hasAttribute("readonly")) {
      return
    }

    if (target.getAttribute("aria-expanded") === "true") {
      return
    }

    // Kobalte opens listbox from keyboard interactions; dispatch an ArrowDown
    // keydown so focus stays in the input and users can type immediately.
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
      }),
    )
  }
  const createNewOption = (
    state: SingleSelectControlState<Option>,
    event: KeyboardEvent,
  ) => {
    if (!local.freeSolo || event.key !== "Enter") {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLInputElement)) {
      return
    }

    const activeDescendant = target.getAttribute("aria-activedescendant")
    if (activeDescendant) {
      return
    }

    const inputValue = target.value.trim()
    if (!inputValue) {
      return
    }

    const defaultOptionFromInput = () => {
      const optionValueKey =
        typeof local.optionValue === "string" ? local.optionValue : undefined
      const optionLabelKey =
        typeof local.optionLabel === "string" ? local.optionLabel : undefined
      const optionTextValueKey =
        typeof local.optionTextValue === "string"
          ? local.optionTextValue
          : undefined
      const mappedKeys = [
        optionValueKey,
        optionLabelKey,
        optionTextValueKey,
      ].filter(Boolean) as string[]

      if (mappedKeys.length === 0) {
        return (inputValue as unknown) as Option
      }

      const option = mappedKeys.reduce<Record<string, string>>((acc, key) => {
        acc[key] = inputValue
        return acc
      }, {})

      return (option as unknown) as Option
    }
    const newOption = local.onCreateOption?.(inputValue) ?? defaultOptionFromInput()

    if (newOption == null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const currentOptions = toArray(
      resolveMaybeAccessor((primitiveProps() as { options?: Option[] }).options),
    )
    const existingOption = currentOptions.find(option =>
      areOptionsEqual(option, newOption),
    )
    const nextOption = existingOption ?? newOption
    const hasExistingOption = !!existingOption
    const optionsWithNew = hasExistingOption
      ? currentOptions
      : [...currentOptions, newOption]

    if (!hasExistingOption) {
      setNewOptions(previous => [...previous, newOption])
      local.onOptionsChange?.(optionsWithNew)
    }

    const selected = toArray(
      state.selectedOptions?.() ??
        resolveMaybeAccessor((primitiveProps() as { value?: Option[] }).value),
    )
    const alreadySelected = selected.some(option =>
      areOptionsEqual(option, nextOption),
    )
    const selectedWithNew = alreadySelected ? selected : [...selected, nextOption]
    const onChange = (
      primitiveProps() as { onChange?: (value: Option | Option[]) => void }
    ).onChange

    const isMultiple = !!local.multiple
    // Commit selection after the option list updates so controlled value
    // sync does not drop newly created values.
    queueMicrotask(() => {
      if (isMultiple) {
        onChange?.(selectedWithNew)
      } else if (alreadySelected) {
        onChange?.(selected[0] as Option)
      } else {
        onChange?.(nextOption)
      }
    })

    clearInputValue(target)
  }
  const selectExistingOptionFromInput = (
    state: SingleSelectControlState<Option>,
    event: KeyboardEvent,
  ) => {
    if (event.key !== "Enter") {
      return false
    }

    const target = event.target
    if (!(target instanceof HTMLInputElement)) {
      return false
    }

    const activeDescendant = target.getAttribute("aria-activedescendant")
    if (activeDescendant) {
      return false
    }

    const matchedOption = findExactInputMatch(target.value)
    if (!matchedOption) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()

    const onChange = (
      primitiveProps() as { onChange?: (value: Option | Option[]) => void }
    ).onChange
    const selected = toArray(
      state.selectedOptions?.() ??
        resolveMaybeAccessor((primitiveProps() as { value?: Option[] }).value),
    )
    const alreadySelected = selected.some(option =>
      areOptionsEqual(option, matchedOption),
    )

    if (local.multiple) {
      onChange?.(alreadySelected ? selected : [...selected, matchedOption])
    } else {
      onChange?.(matchedOption)
    }

    return true
  }
  const removeChip =
    (state: MultiSelectControlState<Option>, option: Option) =>
    (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      state.remove(option)
    }

  const syncListboxScrollHintsFor = (listbox: HTMLElement | undefined) => {
    if (!listbox) {
      setIsListboxScrollable(false)
      setShowScrollHintTop(false)
      setShowScrollHintBottom(false)
      return
    }

    const isScrollable =
      listbox.scrollHeight - listbox.clientHeight > SCROLL_HINT_EPSILON
    const isAtTop = listbox.scrollTop <= SCROLL_HINT_EPSILON
    const isAtBottom =
      listbox.scrollTop + listbox.clientHeight >=
      listbox.scrollHeight - SCROLL_HINT_EPSILON

    setIsListboxScrollable(isScrollable)
    setShowScrollHintTop(isScrollable && !isAtTop)
    setShowScrollHintBottom(isScrollable && !isAtBottom)
  }

  const scheduleListboxHintSync = () => {
    const listbox = listboxRef()
    if (!listbox) {
      syncListboxScrollHintsFor(undefined)
      return
    }

    if (typeof window === "undefined") {
      syncListboxScrollHintsFor(listbox)
      return
    }

    window.requestAnimationFrame(() => {
      syncListboxScrollHintsFor(listbox)
    })
  }

  createEffect(() => {
    const listbox = listboxRef()
    if (!listbox) {
      return
    }

    const handleScroll = () => syncListboxScrollHintsFor(listbox)
    listbox.addEventListener("scroll", handleScroll, { passive: true })

    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        syncListboxScrollHintsFor(listbox)
      })
      resizeObserver.observe(listbox)
    }

    syncListboxScrollHintsFor(listbox)

    onCleanup(() => {
      listbox.removeEventListener("scroll", handleScroll)
      resizeObserver?.disconnect()
    })
  })

  createEffect(() => {
    mergedOptions()
    inputQuery()
    scheduleListboxHintSync()
  })

  return (
    <ComboboxPrimitive<Option, OptGroup>
      class={cx("combobox", local.class, local.containerClass)}
      sameWidth
      gutter={4}
      defaultFilter="contains"
      itemComponent={(itemProps) => (
        <ComboboxPrimitive.Item
          item={itemProps.item}
          data-corvu-no-drag=""
          class={cx("combobox-item", local.itemClass, {
            "combobox-item-auto-highlighted": shouldAutoHighlightOption(
              itemProps.item.rawValue,
            ),
          })}>
          <ComboboxPrimitive.ItemLabel
            data-corvu-no-drag=""
            class="combobox-item-label">
            {local.renderItem?.(itemProps.item.rawValue) ??
              getOptionText(
                itemProps.item.rawValue as Exclude<Option, null>,
                labelAccessor(),
              )}
          </ComboboxPrimitive.ItemLabel>
          {local.showItemIndicator ?? true ? (
            <ComboboxPrimitive.ItemIndicator class="combobox-item-indicator">
              <Icon name="check" />
            </ComboboxPrimitive.ItemIndicator>
          ) : null}
        </ComboboxPrimitive.Item>
      )}
      sectionComponent={(sectionProps) => (
        <ComboboxPrimitive.Section class={cx("combobox-section", local.sectionClass)}>
          {local.renderSection?.(sectionProps.section.rawValue) ??
            getSectionText(
              sectionProps.section.rawValue as Exclude<OptGroup, null>,
            )}
        </ComboboxPrimitive.Section>
      )}
      {...primitiveProps()}>
      <ComboboxPrimitive.HiddenSelect />
      {isNotEmpty(local.label) ? (
        <ComboboxPrimitive.Label class="input-label">
          {local.label}
        </ComboboxPrimitive.Label>
      ) : null}
      <ComboboxPrimitive.Control
        class={cx("combobox-control", local.controlClass)}
        data-corvu-no-drag=""
        aria-label={local["aria-label"]}>
        {(state: SingleSelectControlState<Option>) => (
          <>
            <div class="combobox-value-area">
              {local.multiple && state.selectedOptions().length > 0 ? (
                <div class={cx("combobox-chip-list", local.chipListClass)}>
                  <For each={state.selectedOptions()}>
                    {(option) => {
                      const label = getLabel(option)

                      return local.renderChip ? (
                        local.renderChip(option, {
                          label,
                          remove: () => state.remove(option),
                        })
                      ) : (
                        <span class={cx("combobox-chip", local.chipClass)}>
                          <span class="combobox-chip-label">{label}</span>
                          <button
                            type="button"
                            class={cx(
                              "combobox-chip-remove-button",
                              local.chipRemoveButtonClass,
                            )}
                            aria-label={`Remove ${label}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={removeChip(state, option)}>
                            <Icon name="close" />
                          </button>
                        </span>
                      )
                    }}
                  </For>
                </div>
              ) : null}
              <ComboboxPrimitive.Input
                class={cx("combobox-input", local.inputClass)}
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
                onFocus={openOptionsOnInputFocus}
                onKeyDown={event => {
                  if (selectExistingOptionFromInput(state, event)) {
                    return
                  }

                  createNewOption(state, event)
                }}
              />
            </div>
            <ComboboxPrimitive.Trigger
              class={cx("combobox-trigger", local.triggerClass)}
              onPointerDown={() => {
                suppressOpenOnNextInputFocus = true
              }}
              aria-label="Toggle options">
              <Icon name="keyboard_arrow_down" />
            </ComboboxPrimitive.Trigger>
          </>
        )}
      </ComboboxPrimitive.Control>
      {isNotEmpty(local.hint) ? (
        <ComboboxPrimitive.Description class="input-hint">
          {local.hint}
        </ComboboxPrimitive.Description>
      ) : null}
      {isNotEmpty(local.errorMessage) ? (
        <ComboboxPrimitive.ErrorMessage class="input-error-message">
          {local.errorMessage}
        </ComboboxPrimitive.ErrorMessage>
      ) : null}
      <ComboboxPrimitive.Portal mount={local.portalMount}>
        <ComboboxPrimitive.Content
          data-corvu-no-drag=""
          data-scrollable={isListboxScrollable() ? "" : undefined}
          data-scroll-top={showScrollHintTop() ? "" : undefined}
          data-scroll-bottom={showScrollHintBottom() ? "" : undefined}
          class={cx("combobox-content", local.contentClass)}>
          <div
            class="combobox-scroll-hint top"
            aria-hidden="true">
            <Icon name="keyboard_arrow_up" />
          </div>
          <ComboboxPrimitive.Listbox
            data-corvu-no-drag=""
            ref={setListboxRef}
            class="combobox-listbox"
          />
          <div
            class="combobox-scroll-hint bottom"
            aria-hidden="true">
            <Icon name="keyboard_arrow_down" />
          </div>
        </ComboboxPrimitive.Content>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive>
  )
}
