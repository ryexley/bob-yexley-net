import { Dialog as DialogPrimitive } from "@kobalte/core/dialog"
import { type ParentProps, type JSX } from "solid-js"
import { Icon } from "@/components/icon"
import { cx } from "@/util"
import "./dialog.css"

type DialogProps = ParentProps<{
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
  overlayClass?: string
  class?: string
  style?: JSX.CSSProperties
}>

export function Dialog(props: DialogProps) {
  return (
    <DialogPrimitive
      defaultOpen={props.defaultOpen}
      open={props.open}
      modal={props.modal}
      onOpenChange={props.onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay class={cx("dialog-overlay", props.overlayClass)} />
        <DialogPrimitive.Content
          class={cx("dialog", props.class)}
          style={props.style}>
          {props.children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive>
  )
}

export function DialogHeader(props: ParentProps<{ class?: string }>) {
  return <header class={cx("dialog-header", props.class)}>{props.children}</header>
}

export function DialogTitle(props: ParentProps<{ class?: string }>) {
  return (
    <DialogPrimitive.Title class={cx("dialog-title", props.class)}>
      {props.children}
    </DialogPrimitive.Title>
  )
}

export function DialogDescription(props: ParentProps<{ class?: string }>) {
  return (
    <DialogPrimitive.Description class={cx("dialog-description", props.class)}>
      {props.children}
    </DialogPrimitive.Description>
  )
}

export function DialogBody(props: ParentProps<{ class?: string }>) {
  return <section class={cx("dialog-body", props.class)}>{props.children}</section>
}

export function DialogFooter(props: ParentProps<{ class?: string }>) {
  return <footer class={cx("dialog-footer", props.class)}>{props.children}</footer>
}

type DialogCloseButtonProps = {
  class?: string
  icon?: string
  "aria-label"?: string
}

export function DialogCloseButton(props: DialogCloseButtonProps) {
  return (
    <DialogPrimitive.CloseButton
      class={cx("dialog-close-button", props.class)}
      aria-label={props["aria-label"] || "Close dialog"}>
      <Icon
        name={props.icon || "close"}
        class="dialog-close-icon"
      />
    </DialogPrimitive.CloseButton>
  )
}
