import { Popover as PopoverPrimitive } from "@kobalte/core/popover"
import { type ParentProps, type ComponentProps } from "solid-js"
import { cx } from "@/util"
import "./popover.css"

type PopoverProps = ParentProps<{
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  gutter?: number
  modal?: boolean
  placement?: ComponentProps<typeof PopoverPrimitive>["placement"]
  flip?: ComponentProps<typeof PopoverPrimitive>["flip"]
  shift?: ComponentProps<typeof PopoverPrimitive>["shift"]
}>

export function Popover(props: PopoverProps) {
  return (
    <PopoverPrimitive
      open={props.open}
      defaultOpen={props.defaultOpen}
      onOpenChange={props.onOpenChange}
      gutter={props.gutter}
      modal={props.modal}
      placement={props.placement}
      flip={props.flip}
      shift={props.shift}>
      {props.children}
    </PopoverPrimitive>
  )
}

type PopoverTriggerProps = ParentProps<ComponentProps<typeof PopoverPrimitive.Trigger>>
export function PopoverTrigger(props: PopoverTriggerProps) {
  return (
    <PopoverPrimitive.Trigger
      {...props}
      class={cx("popover-trigger", props.class)}>
      {props.children}
    </PopoverPrimitive.Trigger>
  )
}

type PopoverContentProps = ParentProps<
  ComponentProps<typeof PopoverPrimitive.Content> & {
    arrow?: boolean
    arrowClass?: string
  }
>
export function PopoverContent(props: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        {...props}
        class={cx("popover-content", props.class)}>
        {props.children}
        {props.arrow === false ? null : (
          <PopoverPrimitive.Arrow class={cx("popover-arrow", props.arrowClass)} />
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}
