import { Popover as PopoverPrimitive } from "@kobalte/core/popover"
import { Tooltip as TooltipPrimitive } from "@kobalte/core/tooltip"
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  type ComponentProps,
  type JSXElement,
  type ParentProps,
} from "solid-js"
import { cx } from "@/util"
import "./tooltip.css"

type TooltipProps = ParentProps<{
  content: JSXElement
  disabled?: boolean
  openDelay?: number
  closeDelay?: number
  placement?: ComponentProps<typeof TooltipPrimitive>["placement"]
  triggerClass?: string
  contentClass?: string
  triggerAs?: ComponentProps<typeof TooltipPrimitive.Trigger>["as"]
  triggerProps?: Omit<
    ComponentProps<typeof TooltipPrimitive.Trigger>,
    "children" | "class" | "as"
  >
  touchMode?: "tooltip" | "popover"
}>

const TOUCH_TOOLTIP_MEDIA_QUERY = "(hover: none), (pointer: coarse)"
const [activeTouchPopoverId, setActiveTouchPopoverId] = createSignal<string | null>(
  null,
)

export function Tooltip(props: TooltipProps) {
  const touchPopoverId = createUniqueId()
  const [prefersTouchInput, setPrefersTouchInput] = createSignal(false)
  const isTouchPopoverMode = createMemo(
    () => props.touchMode === "popover" && prefersTouchInput(),
  )
  const isTouchPopoverOpen = createMemo(
    () => isTouchPopoverMode() && activeTouchPopoverId() === touchPopoverId,
  )
  const closeTouchPopover = () => {
    if (activeTouchPopoverId() === touchPopoverId) {
      setActiveTouchPopoverId(null)
    }
  }

  onMount(() => {
    if (props.touchMode !== "popover") {
      return
    }

    if (typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia(TOUCH_TOOLTIP_MEDIA_QUERY)
    const updateTouchMode = () => {
      setPrefersTouchInput(mediaQuery.matches)
      if (!mediaQuery.matches) {
        closeTouchPopover()
      }
    }

    updateTouchMode()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateTouchMode)
      onCleanup(() => mediaQuery.removeEventListener("change", updateTouchMode))
      return
    }

    mediaQuery.addListener(updateTouchMode)
    onCleanup(() => mediaQuery.removeListener(updateTouchMode))
  })

  if (props.disabled) {
    return props.children
  }

  createEffect(() => {
    if (!isTouchPopoverMode()) {
      closeTouchPopover()
    }
  })

  createEffect(() => {
    if (!isTouchPopoverOpen()) {
      return
    }

    const dismiss = () => closeTouchPopover()
    const listenerOptions = { capture: true, passive: true } as AddEventListenerOptions

    window.addEventListener("scroll", dismiss, listenerOptions)
    window.addEventListener("resize", dismiss, listenerOptions)
    window.addEventListener("orientationchange", dismiss, listenerOptions)
    document.addEventListener("scroll", dismiss, listenerOptions)

    onCleanup(() => {
      window.removeEventListener("scroll", dismiss, listenerOptions)
      window.removeEventListener("resize", dismiss, listenerOptions)
      window.removeEventListener("orientationchange", dismiss, listenerOptions)
      document.removeEventListener("scroll", dismiss, listenerOptions)
    })
  })

  onCleanup(() => {
    closeTouchPopover()
  })

  const triggerProps = createMemo(() => props.triggerProps ?? {})

  return (
    <Show
      when={isTouchPopoverMode()}
      fallback={
        <TooltipPrimitive
          placement={props.placement ?? "top"}
          openDelay={props.openDelay ?? 0}
          closeDelay={props.closeDelay ?? 0}>
          <TooltipPrimitive.Trigger
            as={props.triggerAs ?? "span"}
            class={cx("tooltip-trigger", props.triggerClass)}
            {...triggerProps()}>
            {props.children}
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              class={cx("tooltip-content", props.contentClass)}>
              {props.content}
              <TooltipPrimitive.Arrow class="tooltip-arrow" />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive>
      }>
      {(() => {
        const triggerAs = props.triggerAs ?? "button"
        const popoverTriggerProps =
          triggerAs === "button"
            ? {
                type: "button",
                ...triggerProps(),
              }
            : triggerProps()

        return (
          <PopoverPrimitive
            open={isTouchPopoverOpen()}
            onOpenChange={isOpen => {
              setActiveTouchPopoverId(isOpen ? touchPopoverId : null)
            }}
            placement={props.placement ?? "top"}>
            <PopoverPrimitive.Trigger
              as={triggerAs}
              class={cx("tooltip-trigger", props.triggerClass)}
              {...popoverTriggerProps}>
              {props.children}
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                class={cx("tooltip-content", props.contentClass)}
                onOpenAutoFocus={event => event.preventDefault()}
                onCloseAutoFocus={event => event.preventDefault()}
                {...({ bypassTopMostLayerCheck: true } as any)}>
                {props.content}
                <PopoverPrimitive.Arrow class="tooltip-arrow" />
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive>
        )
      })()}
    </Show>
  )
}
