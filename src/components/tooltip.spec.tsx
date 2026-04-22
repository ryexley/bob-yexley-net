import { createContext, Show, useContext } from "solid-js"
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Tooltip } from "@/components/tooltip"

const PopoverContext = createContext<{
  open: () => boolean
  onOpenChange?: (isOpen: boolean) => void
}>()

vi.mock("@kobalte/core/popover", () => ({
  Popover: Object.assign(
    (props: any) => (
      <PopoverContext.Provider
        value={{
          open: () => Boolean(props.open),
          onOpenChange: props.onOpenChange,
        }}>
        <div
          data-testid="popover-root"
          data-open={String(Boolean(props.open))}>
          {props.children}
        </div>
      </PopoverContext.Provider>
    ),
    {
      Trigger: (props: any) => {
        const context = useContext(PopoverContext)!
        const toggle = () => context.onOpenChange?.(!context.open())

        if (props.as === "button") {
          return (
            <button
              type={props.type ?? "button"}
              class={props.class}
              aria-label={props["aria-label"]}
              aria-expanded={context.open()}
              onClick={event => {
                props.onClick?.(event)
                toggle()
              }}
              onPointerDown={event => props.onPointerDown?.(event)}>
              {props.children}
            </button>
          )
        }

        return (
          <span
            class={props.class}
            aria-label={props["aria-label"]}
            role="button"
            tabIndex={0}
            aria-expanded={context.open()}
            onClick={event => {
              props.onClick?.(event)
              toggle()
            }}
            onPointerDown={event => props.onPointerDown?.(event)}>
            {props.children}
          </span>
        )
      },
      Portal: (props: any) => <>{props.children}</>,
      Content: (props: any) => {
        const context = useContext(PopoverContext)!
        return <Show when={context.open()}><div class={props.class}>{props.children}</div></Show>
      },
      Arrow: (props: any) => <div class={props.class} />,
    },
  ),
}))

vi.mock("@kobalte/core/tooltip", () => ({
  Tooltip: Object.assign(
    (props: any) => (
      <div
        data-testid="tooltip-root"
        data-open={String(Boolean(props.open))}>
        {props.children}
      </div>
    ),
    {
      Trigger: (props: any) => {
        if (props.as === "button") {
          return (
            <button
              type="button"
              class={props.class}
              aria-label={props["aria-label"]}
              aria-expanded={props["aria-expanded"]}
              onClick={event => props.onClick?.(event)}
              onKeyDown={event => props.onKeyDown?.(event)}>
              {props.children}
            </button>
          )
        }

        return (
          <span
            class={props.class}
            role={props.role}
            tabIndex={props.tabIndex}
            aria-label={props["aria-label"]}
            aria-expanded={props["aria-expanded"]}
            onClick={event => props.onClick?.(event)}
            onKeyDown={event => props.onKeyDown?.(event)}>
            {props.children}
          </span>
        )
      },
      Portal: (props: any) => <>{props.children}</>,
      Content: (props: any) => <div class={props.class}>{props.children}</div>,
      Arrow: (props: any) => <div class={props.class} />,
    },
  ),
}))

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("Tooltip", () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  it("toggles open on touch devices when touchMode is popover", async () => {
    mockMatchMedia(true)

    render(() => <Tooltip content="Avatar name" touchMode="popover">Avatar</Tooltip>)

    await waitFor(() => {
      expect(screen.getByTestId("popover-root")).toBeTruthy()
    })

    const trigger = screen.getByRole("button", { name: "Avatar" })

    await fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText("Avatar name")).toBeTruthy()
    })
  })

  it("does not switch default span triggers into buttons off touch devices", async () => {
    render(() => <Tooltip content="Avatar name" touchMode="popover">Avatar</Tooltip>)

    expect(screen.queryByRole("button", { name: "Avatar" })).toBeNull()

    await fireEvent.click(screen.getByText("Avatar"))

    expect(screen.getByTestId("tooltip-root").getAttribute("data-open")).toBe("false")
  })

  it("supports explicit button triggers in touch popover mode", async () => {
    mockMatchMedia(true)

    render(() => (
      <Tooltip
        content="Helpful context"
        touchMode="popover"
        triggerAs="button"
        triggerProps={{ "aria-label": "More information" }}>
        ?
      </Tooltip>
    ))

    await waitFor(() => {
      expect(screen.getByTestId("popover-root")).toBeTruthy()
    })

    const trigger = screen.getByRole("button", { name: "More information" })

    await fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByTestId("popover-root")).toBeTruthy()
      expect(screen.getByText("Helpful context")).toBeTruthy()
    })
  })

  it("closes an already open touch popover when another opens", async () => {
    mockMatchMedia(true)

    render(() => (
      <>
        <Tooltip content="First tooltip" touchMode="popover">
          First
        </Tooltip>
        <Tooltip content="Second tooltip" touchMode="popover">
          Second
        </Tooltip>
      </>
    ))

    await fireEvent.click(screen.getByRole("button", { name: "First" }))
    await waitFor(() => {
      expect(screen.getByText("First tooltip")).toBeTruthy()
    })

    await fireEvent.click(screen.getByRole("button", { name: "Second" }))
    await waitFor(() => {
      expect(screen.queryByText("First tooltip")).toBeNull()
      expect(screen.getByText("Second tooltip")).toBeTruthy()
    })
  })

  it("closes an open touch popover on scroll", async () => {
    mockMatchMedia(true)

    render(() => (
      <Tooltip content="Scrollable tooltip" touchMode="popover">
        Trigger
      </Tooltip>
    ))

    await fireEvent.click(screen.getByRole("button", { name: "Trigger" }))
    await waitFor(() => {
      expect(screen.getByText("Scrollable tooltip")).toBeTruthy()
    })

    window.dispatchEvent(new Event("scroll"))

    await waitFor(() => {
      expect(screen.queryByText("Scrollable tooltip")).toBeNull()
    })
  })
})
