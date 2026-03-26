import { Tooltip as TooltipPrimitive } from "@kobalte/core/tooltip"
import { type ComponentProps, type ParentProps } from "solid-js"
import { cx } from "@/util"
import "./tooltip.css"

type TooltipProps = ParentProps<{
  content: string
  disabled?: boolean
  openDelay?: number
  closeDelay?: number
  placement?: ComponentProps<typeof TooltipPrimitive>["placement"]
  triggerClass?: string
  contentClass?: string
}>

export function Tooltip(props: TooltipProps) {
  if (props.disabled) {
    return props.children
  }

  return (
    <TooltipPrimitive
      placement={props.placement ?? "top"}
      openDelay={props.openDelay ?? 0}
      closeDelay={props.closeDelay ?? 0}>
      <TooltipPrimitive.Trigger
        as="span"
        class={cx("tooltip-trigger", props.triggerClass)}>
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
  )
}
