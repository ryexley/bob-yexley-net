import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { For } from "solid-js"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { DatePicker, DateTimePicker } from "@/components/date-time-picker"

vi.mock("@/components/icon", () => ({
  Icon: (props: { name: string }) => <span>{props.name}</span>,
}))

vi.mock("@/components/select", () => ({
  Select: (props: {
    options: Array<{ value: string; label: string; disabled?: boolean }>
    value?: string | null
    onChange?: (value: string | null) => void
    "aria-label"?: string
  }) => (
    <select
      aria-label={props["aria-label"] ?? "Select"}
      onChange={event => props.onChange?.(event.currentTarget.value || null)}>
      <For each={props.options}>
        {option => (
          <option
            value={option.value}
            selected={props.value === option.value}
            disabled={option.disabled}>
            {option.label}
          </option>
        )}
      </For>
    </select>
  ),
}))

vi.mock("@/components/popover", async () => {
  const solid = await import("solid-js")
  const PopoverContext = solid.createContext<{
    open: () => boolean
    onOpenChange?: (open: boolean) => void
  }>()

  return {
    Popover: (props: any) => (
      <PopoverContext.Provider
        value={{
          open: () => Boolean(props.open),
          onOpenChange: open => props.onOpenChange?.(open),
        }}>
        {props.children}
      </PopoverContext.Provider>
    ),
    PopoverAnchor: (props: any) => <div class={props.class}>{props.children}</div>,
    PopoverContent: (props: any) => {
      const context = solid.useContext(PopoverContext)
      let ref: HTMLDivElement | undefined
      let handleMouseDown: ((event: MouseEvent) => void) | undefined
      let handleKeyDown: ((event: KeyboardEvent) => void) | undefined

      solid.onCleanup(() => {
        if (handleMouseDown) {
          document.removeEventListener("mousedown", handleMouseDown)
        }

        if (handleKeyDown) {
          document.removeEventListener("keydown", handleKeyDown)
        }
      })

      solid.createEffect(() => {
        if (!context?.open()) {
          return
        }

        const onOpenChange = context.onOpenChange
        const onEscapeKeyDown = props.onEscapeKeyDown

        handleMouseDown = (event: MouseEvent) => {
          const target = event.target

          if (ref && target instanceof Node && ref.contains(target)) {
            return
          }

          onOpenChange?.(false)
        }

        handleKeyDown = (event: KeyboardEvent) => {
          if (event.key !== "Escape") {
            return
          }

          onEscapeKeyDown?.(event)
          onOpenChange?.(false)
        }

        document.addEventListener("mousedown", handleMouseDown)
        document.addEventListener("keydown", handleKeyDown)
      })

      return (
        <solid.Show when={context?.open()}>
          <div
            ref={ref}
            class={props.class}>
            {props.children}
          </div>
        </solid.Show>
      )
    },
  }
})

describe("DateTimePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-22T10:31:00"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders an empty input with the expected default placeholder", () => {
    render(() => <DateTimePicker />)

    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("")
    expect(input.placeholder).toBe("MM/dd/yyyy")
  })

  it("provides a date-only alias via DatePicker", async () => {
    render(() => <DatePicker />)

    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.placeholder).toBe("MM/dd/yyyy")

    await fireEvent.focus(input)

    expect(screen.getByText("April 2026")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Set date and time" })).toBeNull()
  })

  it("commits a date immediately when time selection is hidden", async () => {
    const onChange = vi.fn()

    render(() => <DateTimePicker onChange={onChange} />)

    const input = screen.getByRole("textbox")
    await fireEvent.focus(input)
    await fireEvent.click(screen.getByRole("button", { name: "April 25, 2026" }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0]).toEqual(new Date("2026-04-25T00:00:00.000"))
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("04/25/2026")
    expect(screen.queryByText("April 2026")).toBeNull()
  })

  it("waits for explicit set when time selection is enabled and discards draft changes on outside click", async () => {
    const onChange = vi.fn()

    render(() => <DateTimePicker showTime onChange={onChange} />)

    const input = screen.getByRole("textbox")
    await fireEvent.focus(input)
    await fireEvent.click(screen.getByRole("button", { name: "April 24, 2026" }))
    await fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(screen.queryByText("April 2026")).toBeNull()
    })

    expect(onChange).not.toHaveBeenCalled()
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("")

    await fireEvent.click(screen.getByRole("button", { name: "Open date picker" }))
    await fireEvent.click(screen.getByRole("button", { name: "April 24, 2026" }))
    await fireEvent.click(screen.getByRole("button", { name: "Set date and time" }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0]).toEqual(new Date("2026-04-24T22:45:00.000"))
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "04/24/2026 10:45 PM",
    )
  })

  it("rounds the initial time seed forward and keeps duplicate 12:00 options", async () => {
    render(() => <DateTimePicker showTime timeGranularity={5} />)

    await fireEvent.focus(screen.getByRole("textbox"))

    const select = screen.getByRole("combobox", { name: "Select time" }) as HTMLSelectElement
    expect(select.value).toBe("635")
    expect(screen.getAllByRole("option", { name: "12:00" })).toHaveLength(2)
  })

  it("shows a validation error when manual input does not match the format", async () => {
    render(() => <DateTimePicker />)

    const input = screen.getByRole("textbox")
    await fireEvent.input(input, { target: { value: "2026-04-22" } })
    await fireEvent.blur(input)

    expect(screen.getByText("Enter a date in MM/dd/yyyy format.")).toBeTruthy()
  })

  it("commits valid manual input and clears an existing format error", async () => {
    const onChange = vi.fn()

    render(() => <DateTimePicker showTime onChange={onChange} />)

    const input = screen.getByRole("textbox")
    await fireEvent.input(input, { target: { value: "bad value" } })
    await fireEvent.blur(input)

    expect(screen.getByText("Enter a date and time in MM/dd/yyyy h:mm a format.")).toBeTruthy()

    await fireEvent.input(input, { target: { value: "04/24/2026 6:15 PM" } })
    await fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledWith(new Date("2026-04-24T18:15:00.000"))
    expect(
      screen.queryByText("Enter a date and time in MM/dd/yyyy h:mm a format."),
    ).toBeNull()
  })

  it("keeps the picker closed on input focus when openOnInputInteraction is false", async () => {
    render(() => <DateTimePicker showTime openOnInputInteraction={false} />)

    const input = screen.getByRole("textbox")
    await fireEvent.focus(input)

    expect(screen.queryByText("April 2026")).toBeNull()

    await fireEvent.click(screen.getByRole("button", { name: "Open date picker" }))

    expect(screen.getByText("April 2026")).toBeTruthy()
  })

  it("opens from a touch pointer without focusing the input", async () => {
    render(() => <DateTimePicker showTime />)

    const input = screen.getByRole("textbox") as HTMLInputElement
    await fireEvent.pointerDown(input, { pointerType: "touch" })

    expect(screen.getByText("April 2026")).toBeTruthy()
    expect(document.activeElement).not.toBe(input)
  })

  it("disables calendar days outside the configured min and max dates", async () => {
    render(() => (
      <DateTimePicker
        minDate={new Date("2026-04-20T00:00:00")}
        maxDate={new Date("2026-04-24T00:00:00")}
      />
    ))

    await fireEvent.focus(screen.getByRole("textbox"))

    expect(screen.getByRole("button", { name: "April 19, 2026" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(screen.getByRole("button", { name: "April 24, 2026" })).toHaveProperty(
      "disabled",
      false,
    )
    expect(screen.getByRole("button", { name: "April 25, 2026" })).toHaveProperty(
      "disabled",
      true,
    )
  })
})
