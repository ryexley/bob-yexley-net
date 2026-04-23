import { Popover as PopoverPrimitive } from "@kobalte/core/popover"
import { splitProps, type ParentProps, type ComponentProps } from "solid-js"
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

type PopoverAnchorProps = ParentProps<ComponentProps<typeof PopoverPrimitive.Anchor>>
export function PopoverAnchor(props: PopoverAnchorProps) {
  return (
    <PopoverPrimitive.Anchor
      {...props}
      class={cx("popover-anchor", props.class)}>
      {props.children}
    </PopoverPrimitive.Anchor>
  )
}

type PopoverContentProps = ParentProps<
  ComponentProps<typeof PopoverPrimitive.Content> & {
    arrow?: boolean
    arrowClass?: string
    // Allows callers inside clipped or modal containers to keep the popover
    // within a specific DOM subtree instead of always portaling to document.body.
    portalMount?: HTMLElement
  }
>
export function PopoverContent(props: PopoverContentProps) {
  const [local, others] = splitProps(props, [
    "arrow",
    "arrowClass",
    "portalMount",
    "class",
    "children",
  ])

  return (
    <PopoverPrimitive.Portal mount={local.portalMount}>
      <PopoverPrimitive.Content
        {...others}
        class={cx("popover-content", local.class)}>
        {local.children}
        {local.arrow === false ? null : (
          <PopoverPrimitive.Arrow class={cx("popover-arrow", local.arrowClass)} />
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}
