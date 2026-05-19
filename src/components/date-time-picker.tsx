import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  mergeProps,
  splitProps,
  untrack,
  type JSX,
} from "solid-js"
import { Select as SelectPrimitive } from "@kobalte/core/select"
import { addDays } from "date-fns/addDays"
import { addMonths } from "date-fns/addMonths"
import { endOfDay } from "date-fns/endOfDay"
import { endOfMonth } from "date-fns/endOfMonth"
import { endOfWeek } from "date-fns/endOfWeek"
import { format } from "date-fns/format"
import { getHours } from "date-fns/getHours"
import { getMinutes } from "date-fns/getMinutes"
import { isSameDay } from "date-fns/isSameDay"
import { isSameMonth } from "date-fns/isSameMonth"
import { isValid } from "date-fns/isValid"
import { parse } from "date-fns/parse"
import { startOfDay } from "date-fns/startOfDay"
import { startOfMonth } from "date-fns/startOfMonth"
import { startOfWeek } from "date-fns/startOfWeek"
import { subMonths } from "date-fns/subMonths"
import { Icon } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/popover"
import { type SelectOption } from "@/components/select"
import { clsx as cx, isNotEmpty } from "@/util"
import "./select.css"
import "./date-time-picker.css"

type TimeGranularity = 5 | 15 | 30 | 60
type Meridiem = "AM" | "PM"

const TIME_SELECT_CLOSE_GUARD_MS = 150

type DateTimePickerProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  value?: Date | null
  defaultValue?: Date | null
  onChange?: (value: Date | null) => void
  label?: string
  errorMessage?: string
  hint?: string
  containerClass?: string
  inputClass?: string
  showTime?: boolean
  timeGranularity?: TimeGranularity
  format?: string
  minDate?: Date
  maxDate?: Date
  openOnInputInteraction?: boolean
  // Lets callers provide a dialog-safe mount point for the picker and nested
  // time-select overlays. Without this, body-level portals can fall outside a
  // modal's focus/dismissable-layer boundary.
  portalMount?: HTMLElement
}

export type DatePickerProps = DateTimePickerProps

type TimeOption = SelectOption & {
  minutes: number
}

const DEFAULT_DATE_FORMAT = "MM/dd/yyyy"
const DEFAULT_DATE_TIME_FORMAT = "MM/dd/yyyy h:mm a"
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const TIME_GRANULARITY_OPTIONS = new Set<TimeGranularity>([5, 15, 30, 60])

function cloneDate(value: Date | null | undefined) {
  return value ? new Date(value) : null
}

function getMonthLabel(value: Date) {
  return format(value, "MMMM yyyy")
}

function getDayLabel(value: Date) {
  return format(value, "d")
}

function formatDisplayValue(value: Date | null, formatString: string) {
  if (!value) {
    return ""
  }

  try {
    return format(value, formatString)
  } catch {
    return ""
  }
}

function getDefaultFormat(showTime: boolean) {
  return showTime ? DEFAULT_DATE_TIME_FORMAT : DEFAULT_DATE_FORMAT
}

function getNormalizedTimeGranularity(value: TimeGranularity | undefined) {
  return value && TIME_GRANULARITY_OPTIONS.has(value) ? value : 15
}

function ceilToStep(value: Date, step: TimeGranularity) {
  const nextValue = new Date(value)
  nextValue.setSeconds(0, 0)
  const minutes = nextValue.getMinutes()
  const remainder = minutes % step

  if (remainder !== 0) {
    nextValue.setMinutes(minutes + step - remainder)
  }

  return nextValue
}

function floorToStep(value: Date, step: TimeGranularity) {
  const nextValue = new Date(value)
  nextValue.setSeconds(0, 0)
  const minutes = nextValue.getMinutes()
  const remainder = minutes % step

  if (remainder !== 0) {
    nextValue.setMinutes(minutes - remainder)
  }

  return nextValue
}

function getDateOnlySeed(minDate?: Date, maxDate?: Date) {
  const today = startOfDay(new Date())

  if (minDate && today < startOfDay(minDate)) {
    return startOfDay(minDate)
  }

  if (maxDate && today > startOfDay(maxDate)) {
    return startOfDay(maxDate)
  }

  return today
}

function getTimeSeed(
  step: TimeGranularity,
  minDate?: Date,
  maxDate?: Date,
) {
  let nextValue = ceilToStep(new Date(), step)

  if (minDate && nextValue < minDate) {
    nextValue = ceilToStep(minDate, step)
  }

  if (maxDate && nextValue > maxDate) {
    nextValue = floorToStep(maxDate, step)
  }

  return nextValue
}

function getSeedValue(
  value: Date | null,
  showTime: boolean,
  step: TimeGranularity,
  minDate?: Date,
  maxDate?: Date,
) {
  if (value) {
    return cloneDate(value)
  }

  return showTime
    ? getTimeSeed(step, minDate, maxDate)
    : getDateOnlySeed(minDate, maxDate)
}

function buildCalendarWeeks(month: Date) {
  const firstVisibleDay = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const lastVisibleDay = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days: Date[] = []

  for (
    let currentDay = firstVisibleDay;
    currentDay <= lastVisibleDay;
    currentDay = addDays(currentDay, 1)
  ) {
    days.push(new Date(currentDay))
  }

  const weeks: Date[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return weeks
}

function getMeridiem(value: Date): Meridiem {
  return getHours(value) >= 12 ? "PM" : "AM"
}

function getTimeValue(value: Date) {
  const hours = getHours(value)
  const minutes = getMinutes(value)
  return String((hours % 12) * 60 + minutes)
}

function getTimeLabel(minutes: number) {
  const normalizedMinutes = minutes === 720 ? 0 : minutes
  const hourIndex = Math.floor(normalizedMinutes / 60)
  const hour = hourIndex === 0 ? 12 : hourIndex
  const minute = normalizedMinutes % 60
  return `${hour}:${String(minute).padStart(2, "0")}`
}

function buildTimeOptions(step: TimeGranularity): TimeOption[] {
  const options: TimeOption[] = []

  for (let minutes = 0; minutes <= 720; minutes += step) {
    options.push({
      value: String(minutes),
      label: getTimeLabel(minutes),
      minutes,
    })
  }

  return options
}

function combineDateAndTime(
  dateValue: Date,
  meridiem: Meridiem,
  timeValue: string,
) {
  const nextValue = new Date(dateValue)
  const normalizedMinutes = Number(timeValue) === 720 ? 0 : Number(timeValue)
  const hourIndex = Math.floor(normalizedMinutes / 60)
  const minute = normalizedMinutes % 60
  let hours = hourIndex === 0 ? 12 : hourIndex

  if (hours === 12) {
    hours = meridiem === "AM" ? 0 : 12
  } else if (meridiem === "PM") {
    hours += 12
  }

  nextValue.setHours(hours, minute, 0, 0)
  return nextValue
}

function isWithinDateBounds(value: Date, minDate?: Date, maxDate?: Date) {
  const dateOnly = startOfDay(value)

  if (minDate && dateOnly < startOfDay(minDate)) {
    return false
  }

  if (maxDate && dateOnly > startOfDay(maxDate)) {
    return false
  }

  return true
}

function isWithinDateTimeBounds(value: Date, minDate?: Date, maxDate?: Date) {
  if (minDate && value < minDate) {
    return false
  }

  if (maxDate && value > maxDate) {
    return false
  }

  return true
}

function isDayDisabled(
  day: Date,
  showTime: boolean,
  minDate?: Date,
  maxDate?: Date,
) {
  if (!showTime) {
    return !isWithinDateBounds(day, minDate, maxDate)
  }

  if (minDate && endOfDay(day) < minDate) {
    return true
  }

  if (maxDate && startOfDay(day) > maxDate) {
    return true
  }

  return false
}

function getBoundErrorMessage(
  value: Date,
  showTime: boolean,
  formatString: string,
  minDate?: Date,
  maxDate?: Date,
) {
  const formatter = (boundValue: Date) =>
    formatDisplayValue(boundValue, formatString) || formatString

  if (!showTime) {
    if (minDate && startOfDay(value) < startOfDay(minDate)) {
      return `Enter a date on or after ${formatter(minDate)}.`
    }

    if (maxDate && startOfDay(value) > startOfDay(maxDate)) {
      return `Enter a date on or before ${formatter(maxDate)}.`
    }

    return null
  }

  if (minDate && value < minDate) {
    return `Enter a date and time on or after ${formatter(minDate)}.`
  }

  if (maxDate && value > maxDate) {
    return `Enter a date and time on or before ${formatter(maxDate)}.`
  }

  return null
}

function getFormatErrorMessage(showTime: boolean, formatString: string) {
  return showTime
    ? `Enter a date and time in ${formatString} format.`
    : `Enter a date in ${formatString} format.`
}

function callInputEventHandler(handler: unknown, event: Event) {
  if (!handler) {
    return
  }

  if (Array.isArray(handler)) {
    const [eventHandler, data] = handler as [(data: unknown, event: Event) => void, unknown]
    eventHandler(data, event)
    return
  }

  ;(handler as (event: Event) => void)(event)
}

function shouldPreventTouchInputFocus(event: PointerEvent) {
  return event.pointerType === "touch"
}

function containsEventTarget(
  element: HTMLElement | undefined,
  target: EventTarget | null | undefined,
) {
  return !!(element && target instanceof Node && element.contains(target))
}

function isOwnedOverlayTarget(
  target: EventTarget | null | undefined,
  selector: string,
) {
  return target instanceof Element && target.closest(selector) !== null
}

function getClosestValidTimeSelection(
  dateValue: Date,
  preferredMeridiem: Meridiem,
  preferredTimeValue: string,
  options: TimeOption[],
  minDate?: Date,
  maxDate?: Date,
) {
  const isValidSelection = (meridiem: Meridiem, timeValue: string) =>
    isWithinDateTimeBounds(
      combineDateAndTime(dateValue, meridiem, timeValue),
      minDate,
      maxDate,
    )

  if (isValidSelection(preferredMeridiem, preferredTimeValue)) {
    return {
      meridiem: preferredMeridiem,
      timeValue: preferredTimeValue,
    }
  }

  const pickFirstEnabled = (meridiem: Meridiem) => {
    const match = options.find(option => isValidSelection(meridiem, option.value))
    return match
      ? {
          meridiem,
          timeValue: match.value,
        }
      : null
  }

  return (
    pickFirstEnabled(preferredMeridiem) ??
    pickFirstEnabled(preferredMeridiem === "AM" ? "PM" : "AM") ?? {
      meridiem: preferredMeridiem,
      timeValue: preferredTimeValue,
    }
  )
}

export function DateTimePicker(props: DateTimePickerProps) {
  const propsWithDefaults = mergeProps(
    {
      showTime: false,
      openOnInputInteraction: true,
    },
    props,
  )
  const [local, attrs] = splitProps(propsWithDefaults, [
    "value",
    "defaultValue",
    "onChange",
    "label",
    "errorMessage",
    "hint",
    "containerClass",
    "inputClass",
    "showTime",
    "timeGranularity",
    "format",
    "minDate",
    "maxDate",
    "openOnInputInteraction",
    "portalMount",
    "placeholder",
    "id",
    "disabled",
    "onInput",
    "onFocus",
    "onClick",
    "onPointerDown",
    "onBlur",
    "onKeyDown",
  ])
  let rootRef: HTMLDivElement | undefined
  const generatedId = createUniqueId()
  const inputId = createMemo(() => local.id ?? `date-time-picker-${generatedId}`)
  const descriptionId = createMemo(() =>
    isNotEmpty(local.hint) ? `${inputId()}-hint` : undefined,
  )
  const step = createMemo(() => getNormalizedTimeGranularity(local.timeGranularity))
  const formatString = createMemo(() =>
    local.format ?? getDefaultFormat(local.showTime),
  )
  const placeholder = createMemo(() => local.placeholder ?? formatString())
  const timeOptions = createMemo(() => buildTimeOptions(step()))
  const [internalValue, setInternalValue] = createSignal<Date | null>(
    cloneDate(local.defaultValue),
  )
  const selectedValue = createMemo(() =>
    local.value !== undefined ? cloneDate(local.value) : internalValue(),
  )
  const [inputValue, setInputValue] = createSignal("")
  const [validationError, setValidationError] = createSignal<string | null>(null)
  const [open, setOpen] = createSignal(false)
  const [timeSelectOpen, setTimeSelectOpen] = createSignal(false)
  const [timeSelectOpenedAtMs, setTimeSelectOpenedAtMs] = createSignal<number | null>(null)
  const initialSeedValue = untrack(
    () =>
      getSeedValue(
        selectedValue(),
        local.showTime,
        step(),
        local.minDate,
        local.maxDate,
      )!,
  )
  const [displayMonth, setDisplayMonth] = createSignal(startOfMonth(initialSeedValue))
  const [draftDate, setDraftDate] = createSignal<Date>(
    startOfDay(initialSeedValue),
  )
  const [draftMeridiem, setDraftMeridiem] = createSignal<Meridiem>("PM")
  const [draftTimeValue, setDraftTimeValue] = createSignal("0")
  const activeErrorMessage = createMemo(() => validationError() ?? local.errorMessage ?? null)
  const activeErrorId = createMemo(() =>
    isNotEmpty(activeErrorMessage()) ? `${inputId()}-error` : undefined,
  )
  const describedBy = createMemo(() =>
    [descriptionId(), activeErrorId()].filter(Boolean).join(" ") || undefined,
  )
  const calendarWeeks = createMemo(() => buildCalendarWeeks(displayMonth()))
  const draftDateTime = createMemo(() =>
    combineDateAndTime(draftDate(), draftMeridiem(), draftTimeValue()),
  )
  const isSetDisabled = createMemo(
    () =>
      !isWithinDateTimeBounds(draftDateTime(), local.minDate, local.maxDate),
  )
  const draftTimeOptions = createMemo<SelectOption[]>(() =>
    timeOptions().map(option => ({
      value: option.value,
      label: option.label,
      disabled: !isWithinDateTimeBounds(
        combineDateAndTime(draftDate(), draftMeridiem(), option.value),
        local.minDate,
        local.maxDate,
      ),
    })),
  )
  let suppressInputOpenOnce = false
  let anchorRef: HTMLDivElement | undefined
  let panelRef: HTMLDivElement | undefined
  let timeSelectFieldRef: HTMLDivElement | undefined
  const ownedOverlaySelector = ".date-time-picker-owned-overlay"

  // The time select lives inside a popover inside a dialog. These guards keep
  // clicks/focus transitions within any part of that owned overlay stack from
  // being misclassified as "outside" interactions by Kobalte.
  const preventInternalDismiss = (
    event: Event & { detail?: { originalEvent?: Event } },
  ) => {
    const target = event.detail?.originalEvent?.target ?? event.target

    if (
      !containsEventTarget(anchorRef, target) &&
      !containsEventTarget(panelRef, target) &&
      !isOwnedOverlayTarget(target, ownedOverlaySelector)
    ) {
      return
    }

    event.preventDefault()
  }

  const closeTimeSelect = () => {
    if (timeSelectOpen()) {
      setTimeSelectOpen(false)
    }

    setTimeSelectOpenedAtMs(null)
  }

  const getCurrentTimeMs = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now()

  // In the desktop modal path, Kobalte can emit an immediate close after the
  // time select opens because nested overlay events race each other. This
  // small guard keeps the first spurious close from collapsing the menu.
  const handleTimeSelectOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setTimeSelectOpen(true)
      setTimeSelectOpenedAtMs(getCurrentTimeMs())
      return
    }

    const openedAtMs = timeSelectOpenedAtMs()
    if (openedAtMs !== null && getCurrentTimeMs() - openedAtMs < TIME_SELECT_CLOSE_GUARD_MS) {
      return
    }

    closeTimeSelect()
  }

  const handlePanelPointerDown = (event: PointerEvent) => {
    const target = event.target

    if (
      !timeSelectOpen() ||
      containsEventTarget(timeSelectFieldRef, target) ||
      isOwnedOverlayTarget(target, ownedOverlaySelector)
    ) {
      return
    }

    closeTimeSelect()
  }

  const syncDraftState = (baseValue: Date | null) => {
    const seededValue = getSeedValue(
      baseValue,
      local.showTime,
      step(),
      local.minDate,
      local.maxDate,
    )

    if (!seededValue) {
      return
    }

    const nextDate = startOfDay(seededValue)
    const nextMeridiem = local.showTime
      ? baseValue
        ? getMeridiem(seededValue)
        : "PM"
      : "PM"
    const nextTimeValue = local.showTime ? getTimeValue(seededValue) : "0"
    const nextSelection = local.showTime
      ? getClosestValidTimeSelection(
          nextDate,
          nextMeridiem,
          nextTimeValue,
          timeOptions(),
          local.minDate,
          local.maxDate,
        )
      : {
          meridiem: nextMeridiem,
          timeValue: nextTimeValue,
        }

    setDraftDate(nextDate)
    setDraftMeridiem(nextSelection.meridiem)
    setDraftTimeValue(nextSelection.timeValue)
    setDisplayMonth(startOfMonth(nextDate))
  }

  const commitValue = (value: Date | null) => {
    const nextValue = cloneDate(value)

    if (local.value === undefined) {
      setInternalValue(nextValue)
    }

    local.onChange?.(nextValue)
  }

  const closePicker = () => {
    if (!open()) {
      return
    }

    suppressInputOpenOnce = true
    setTimeSelectOpen(false)
    setOpen(false)

    if (local.showTime) {
      syncDraftState(selectedValue())
    }
  }

  const openPicker = () => {
    if (local.disabled) {
      return
    }

    setTimeSelectOpen(false)
    syncDraftState(selectedValue())
    setOpen(true)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      openPicker()
      return
    }

    closePicker()
  }

  const commitParsedValue = (rawValue: string) => {
    const nextValue = rawValue.trim()

    if (!nextValue) {
      setValidationError(null)
      commitValue(null)
      return true
    }

    const parsedValue = parse(nextValue, formatString(), new Date())
    const expectedValue = formatDisplayValue(parsedValue, formatString())

    if (!isValid(parsedValue) || expectedValue !== nextValue) {
      setValidationError(getFormatErrorMessage(local.showTime, formatString()))
      return false
    }

    const normalizedValue = local.showTime ? parsedValue : startOfDay(parsedValue)
    const boundError = getBoundErrorMessage(
      normalizedValue,
      local.showTime,
      formatString(),
      local.minDate,
      local.maxDate,
    )

    if (boundError) {
      setValidationError(boundError)
      return false
    }

    setValidationError(null)
    commitValue(normalizedValue)
    return true
  }

  const handleInputInteractionOpen = () => {
    if (!local.openOnInputInteraction || local.disabled) {
      return
    }

    if (suppressInputOpenOnce) {
      suppressInputOpenOnce = false
      return
    }

    setOpen(true)
    syncDraftState(selectedValue())
  }

  const selectDay = (day: Date) => {
    if (isDayDisabled(day, local.showTime, local.minDate, local.maxDate)) {
      return
    }

    const nextDay = startOfDay(day)
    setDraftDate(nextDay)
    setDisplayMonth(startOfMonth(nextDay))

    if (!local.showTime) {
      const committedDay = startOfDay(day)
      setValidationError(null)
      commitValue(committedDay)
      closePicker()
      return
    }

    const nextSelection = getClosestValidTimeSelection(
      nextDay,
      draftMeridiem(),
      draftTimeValue(),
      timeOptions(),
      local.minDate,
      local.maxDate,
    )
    setDraftMeridiem(nextSelection.meridiem)
    setDraftTimeValue(nextSelection.timeValue)
  }

  const setTimeMeridiem = (nextMeridiem: Meridiem) => {
    const nextSelection = getClosestValidTimeSelection(
      draftDate(),
      nextMeridiem,
      draftTimeValue(),
      timeOptions(),
      local.minDate,
      local.maxDate,
    )
    setDraftMeridiem(nextSelection.meridiem)
    setDraftTimeValue(nextSelection.timeValue)
  }

  const handleSetClick = () => {
    if (isSetDisabled()) {
      return
    }

    setValidationError(null)
    commitValue(draftDateTime())
    closePicker()
  }

  const selectedDraftTimeOption = createMemo(
    () => draftTimeOptions().find(option => option.value === draftTimeValue()) ?? null,
  )

  createEffect(() => {
    const value = selectedValue()
    setInputValue(formatDisplayValue(value, formatString()))
    setValidationError(null)
    syncDraftState(value)
  })

  return (
    <div
      ref={rootRef}
      class={cx("date-time-picker", local.containerClass)}
      data-show-time={local.showTime ? "" : undefined}>
      <Show when={isNotEmpty(local.label)}>
        <label
          class="label"
          for={inputId()}>
          {local.label}
        </label>
      </Show>
      <Popover
        open={open()}
        onOpenChange={handleOpenChange}
        gutter={4}
        placement="bottom-start"
        flip
        shift={0}>
        <PopoverAnchor
          ref={anchorRef}
          class="anchor">
          <div
            class="control"
            data-invalid={activeErrorMessage() ? "" : undefined}
            data-disabled={local.disabled ? "" : undefined}>
            <input
              {...attrs}
              id={inputId()}
              type="text"
              class={cx("input", local.inputClass)}
              value={inputValue()}
              placeholder={placeholder()}
              disabled={local.disabled}
              aria-invalid={activeErrorMessage() ? "true" : undefined}
              aria-haspopup="dialog"
              aria-describedby={describedBy()}
              onInput={event => {
                setInputValue(event.currentTarget.value)

                if (validationError()) {
                  void commitParsedValue(event.currentTarget.value)
                }

                callInputEventHandler(local.onInput, event)
              }}
              onFocus={event => {
                handleInputInteractionOpen()
                callInputEventHandler(local.onFocus, event)
              }}
              onClick={event => {
                handleInputInteractionOpen()
                callInputEventHandler(local.onClick, event)
              }}
              onPointerDown={event => {
                if (
                  shouldPreventTouchInputFocus(event) &&
                  local.openOnInputInteraction &&
                  !local.disabled
                ) {
                  event.preventDefault()
                  openPicker()
                }

                callInputEventHandler(local.onPointerDown, event)
              }}
              onBlur={event => {
                void commitParsedValue(event.currentTarget.value)
                callInputEventHandler(local.onBlur, event)
              }}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  const committed = commitParsedValue(event.currentTarget.value)

                  if (committed) {
                    closePicker()
                  }
                }

                if (event.key === "Escape" && open()) {
                  event.preventDefault()
                  closePicker()
                }

                callInputEventHandler(local.onKeyDown, event)
              }}
            />
            <button
              type="button"
              class="trigger"
              data-open={open() ? "" : undefined}
              aria-label={open() ? "Close date picker" : "Open date picker"}
              disabled={local.disabled}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                if (open()) {
                  closePicker()
                  return
                }

                openPicker()
              }}>
              <Icon name="calendar_month" />
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          portalMount={local.portalMount ?? rootRef}
          class={cx("date-time-picker-content", {
            "with-time": local.showTime,
          })}
          arrow={false}
          onOpenAutoFocus={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}
          onFocusOutside={preventInternalDismiss}
          onPointerDownOutside={preventInternalDismiss}
          onInteractOutside={preventInternalDismiss}
          // This is an escape hatch for the nested dialog -> popover -> select
          // stack used by the blip editor metadata panel. Keep this localized
          // unless we find a cleaner library-supported pattern.
          {...({ bypassTopMostLayerCheck: true } as any)}>
          <div
            class="panel"
            ref={element => {
              panelRef = element
            }}
            onPointerDown={handlePanelPointerDown}>
            <div class="header">
              <button
                type="button"
                class="nav"
                aria-label="Previous month"
                onMouseDown={event => event.preventDefault()}
                onClick={() => setDisplayMonth(current => subMonths(current, 1))}>
                <Icon name="chevron_left" />
              </button>
              <div class="month">{getMonthLabel(displayMonth())}</div>
              <button
                type="button"
                class="nav"
                aria-label="Next month"
                onMouseDown={event => event.preventDefault()}
                onClick={() => setDisplayMonth(current => addMonths(current, 1))}>
                <Icon name="chevron_right" />
              </button>
            </div>
            <div class="calendar">
              <div
                class="weekdays"
                aria-hidden="true">
                <For each={WEEKDAY_LABELS}>
                  {label => <div class="weekday">{label}</div>}
                </For>
              </div>
              <div class="grid">
                <For each={calendarWeeks()}>
                  {week => (
                    <div class="week">
                      <For each={week}>
                        {day => {
                          const disabled = createMemo(() =>
                            isDayDisabled(day, local.showTime, local.minDate, local.maxDate),
                          )
                          const selected = createMemo(() =>
                            isSameDay(day, draftDate()),
                          )

                          return (
                            <button
                              type="button"
                              class="day"
                              data-outside-month={!isSameMonth(day, displayMonth()) ? "" : undefined}
                              data-selected={selected() ? "" : undefined}
                              disabled={disabled()}
                              aria-label={format(day, "MMMM d, yyyy")}
                              aria-pressed={selected() ? "true" : "false"}
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => selectDay(day)}>
                              {getDayLabel(day)}
                            </button>
                          )
                        }}
                      </For>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <Show when={local.showTime}>
              <div class="time-row">
                <SelectPrimitive
                  ref={element => {
                    timeSelectFieldRef = element
                  }}
                  options={draftTimeOptions()}
                  optionValue="value"
                  optionTextValue="label"
                  optionDisabled="disabled"
                  value={selectedDraftTimeOption()}
                  open={timeSelectOpen()}
                  onOpenChange={handleTimeSelectOpenChange}
                  onChange={option => {
                    if (option) {
                      setDraftTimeValue(option.value)
                    }

                    closeTimeSelect()
                  }}
                  class="select-field _time-select-field"
                  // The shared Select wrapper does not expose enough control for
                  // this nested-overlay case, so the time menu uses primitives
                  // directly to manage its open state and dismiss behavior.
                  itemComponent={props => (
                    <SelectPrimitive.Item
                      item={props.item}
                      class="select-item">
                      <span class="select-item-label">{props.item.rawValue.label}</span>
                      <span class="select-item-indicator" aria-hidden="true">
                        <Icon name="check" />
                      </span>
                    </SelectPrimitive.Item>
                  )}>
                  <SelectPrimitive.HiddenSelect />
                  <SelectPrimitive.Trigger
                    class="select-trigger _time-select"
                    aria-label="Select time">
                    <SelectPrimitive.Value<SelectOption> class="select-value">
                      {state => state.selectedOption().label}
                    </SelectPrimitive.Value>
                    <span class="select-trigger-icon" aria-hidden="true">
                      <Icon name="expand_more" />
                    </span>
                  </SelectPrimitive.Trigger>
                  <SelectPrimitive.Portal mount={local.portalMount ?? rootRef}>
                    <SelectPrimitive.Content
                      class="select-content _time-select-content date-time-picker-owned-overlay"
                      // These handlers intentionally keep the nested time menu
                      // inside the parent picker's interaction boundary.
                      onCloseAutoFocus={event => event.preventDefault()}
                      onFocusOutside={event => event.preventDefault()}
                      onPointerDownOutside={event => event.preventDefault()}
                      onInteractOutside={event => event.preventDefault()}>
                      <SelectPrimitive.Listbox class="select-listbox" />
                    </SelectPrimitive.Content>
                  </SelectPrimitive.Portal>
                </SelectPrimitive>
                <div
                  class="meridiem"
                  role="group"
                  aria-label="Select AM or PM">
                  <button
                    type="button"
                    class="meridiem-option"
                    data-selected={draftMeridiem() === "AM" ? "" : undefined}
                    onClick={() => setTimeMeridiem("AM")}>
                    AM
                  </button>
                  <button
                    type="button"
                    class="meridiem-option"
                    data-selected={draftMeridiem() === "PM" ? "" : undefined}
                    onClick={() => setTimeMeridiem("PM")}>
                    PM
                  </button>
                </div>
                <IconButton
                  icon="check_circle"
                  size="sm"
                  class="set"
                  aria-label="Set date and time"
                  disabled={isSetDisabled()}
                  onMouseDown={event => event.preventDefault()}
                  onClick={handleSetClick}
                />
              </div>
            </Show>
          </div>
        </PopoverContent>
      </Popover>
      <Show when={isNotEmpty(local.hint)}>
        <div
          id={descriptionId()}
          class="hint">
          {local.hint}
        </div>
      </Show>
      <Show when={isNotEmpty(activeErrorMessage())}>
        <div
          id={activeErrorId()}
          class="error-message">
          {activeErrorMessage()}
        </div>
      </Show>
    </div>
  )
}

export function DatePicker(props: DatePickerProps) {
  return (
    <DateTimePicker
      {...props}
      showTime={props.showTime ?? false}
    />
  )
}
