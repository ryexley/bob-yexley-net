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
  content: JSXElement | (() => JSXElement)
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
  touchFullWidth?: boolean
}>

function touchPopoverMarginPx() {
  if (typeof document === "undefined") {
    return 16
  }

  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

function getTouchFullWidthAnchorRect(anchor?: HTMLElement) {
  if (!anchor || typeof window === "undefined") {
    return undefined
  }

  const rect = anchor.getBoundingClientRect()
  const margin = touchPopoverMarginPx()

  return {
    x: margin,
    y: rect.top,
    width: window.innerWidth - margin * 2,
    height: rect.height,
  }
}

const TOUCH_FULL_WIDTH_ARROW_PADDING_PX = 12

function alignTouchFullWidthArrow(trigger: HTMLElement, content: HTMLElement) {
  const arrow = content.querySelector(".tooltip-arrow")
  if (!(arrow instanceof HTMLElement)) {
    return
  }

  const triggerRect = trigger.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const arrowWidth = arrow.offsetWidth || 30
  const triggerCenterX = triggerRect.left + triggerRect.width / 2
  let arrowLeft = triggerCenterX - contentRect.left - arrowWidth / 2
  const maxLeft = Math.max(
    TOUCH_FULL_WIDTH_ARROW_PADDING_PX,
    contentRect.width - arrowWidth - TOUCH_FULL_WIDTH_ARROW_PADDING_PX,
  )

  arrowLeft = Math.max(
    TOUCH_FULL_WIDTH_ARROW_PADDING_PX,
    Math.min(maxLeft, arrowLeft),
  )

  const nextLeft = `${Math.round(arrowLeft)}px`
  if (arrow.style.left !== nextLeft) {
    arrow.style.left = nextLeft
  }
}

function watchTouchFullWidthArrow(trigger: HTMLElement, content: HTMLElement) {
  const arrow = content.querySelector(".tooltip-arrow")
  if (!(arrow instanceof HTMLElement)) {
    return () => {}
  }

  const sync = () => alignTouchFullWidthArrow(trigger, content)

  sync()

  const observer = new MutationObserver(sync)
  observer.observe(arrow, { attributes: true, attributeFilter: ["style"] })

  const resizeObserver =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(sync)
      : undefined

  resizeObserver?.observe(content)
  resizeObserver?.observe(trigger)

  window.addEventListener("resize", sync, { passive: true })
  window.addEventListener("orientationchange", sync, { passive: true })

  return () => {
    observer.disconnect()
    resizeObserver?.disconnect()
    window.removeEventListener("resize", sync)
    window.removeEventListener("orientationchange", sync)
  }
}

const TOUCH_TOOLTIP_MEDIA_QUERY = "(hover: none), (pointer: coarse)"
const [activeTouchPopoverId, setActiveTouchPopoverId] = createSignal<string | null>(
  null,
)

export function Tooltip(props: TooltipProps) {
  const touchPopoverId = createUniqueId()
  let touchPopoverContentRef: HTMLElement | undefined
  let touchPopoverTriggerRef: HTMLElement | undefined
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

    const dismissOnViewportChange = (event: Event) => {
      const target = event.target
      if (
        touchPopoverContentRef &&
        target instanceof Node &&
        touchPopoverContentRef.contains(target)
      ) {
        return
      }

      closeTouchPopover()
    }
    const listenerOptions = { capture: true, passive: true } as AddEventListenerOptions

    window.addEventListener("scroll", dismissOnViewportChange, listenerOptions)
    window.addEventListener("resize", dismissOnViewportChange, listenerOptions)
    window.addEventListener("orientationchange", dismissOnViewportChange, listenerOptions)
    document.addEventListener("scroll", dismissOnViewportChange, listenerOptions)

    onCleanup(() => {
      window.removeEventListener("scroll", dismissOnViewportChange, listenerOptions)
      window.removeEventListener("resize", dismissOnViewportChange, listenerOptions)
      window.removeEventListener(
        "orientationchange",
        dismissOnViewportChange,
        listenerOptions,
      )
      document.removeEventListener("scroll", dismissOnViewportChange, listenerOptions)
    })
  })

  createEffect(() => {
    if (!isTouchPopoverOpen() || !props.touchFullWidth) {
      return
    }

    let cleanup = () => {}
    const frame = requestAnimationFrame(() => {
      const trigger = touchPopoverTriggerRef
      const content = touchPopoverContentRef

      if (trigger && content) {
        cleanup = watchTouchFullWidthArrow(trigger, content)
      }
    })

    onCleanup(() => {
      cancelAnimationFrame(frame)
      cleanup()
    })
  })

  onCleanup(() => {
    closeTouchPopover()
  })

  const triggerProps = createMemo(() => props.triggerProps ?? {})
  const renderedContent = () => {
    const value = props.content
    return typeof value === "function" ? value() : value
  }

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
              {renderedContent()}
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

        const touchFullWidth = props.touchFullWidth ?? false
        const touchMargin = touchPopoverMarginPx()

        return (
          <PopoverPrimitive
            open={isTouchPopoverOpen()}
            onOpenChange={isOpen => {
              setActiveTouchPopoverId(isOpen ? touchPopoverId : null)
            }}
            placement={props.placement ?? "top"}
            flip
            shift={touchFullWidth ? false : true}
            sameWidth={touchFullWidth ? true : undefined}
            overflowPadding={touchFullWidth ? touchMargin : undefined}
            getAnchorRect={touchFullWidth ? getTouchFullWidthAnchorRect : undefined}>
            <PopoverPrimitive.Trigger
              as={triggerAs}
              ref={touchPopoverTriggerRef}
              class={cx("tooltip-trigger", props.triggerClass)}
              {...popoverTriggerProps}>
              {props.children}
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                ref={touchPopoverContentRef}
                class={cx("tooltip-content", props.contentClass)}
                onOpenAutoFocus={event => event.preventDefault()}
                onCloseAutoFocus={event => event.preventDefault()}
                {...({ bypassTopMostLayerCheck: true } as any)}>
                {renderedContent()}
                <PopoverPrimitive.Arrow class="tooltip-arrow" />
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive>
        )
      })()}
    </Show>
  )
}
