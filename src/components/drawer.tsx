import {
  mergeProps,
  splitProps,
  ValidComponent,
  Component,
  JSX,
  createMemo,
  ComponentProps,
} from "solid-js"
import DrawerPrimitive from "@corvu/drawer"
import { Icon } from "./icon"
import { clsx as cx, isNotEmpty } from "@/util"
// Drawer styles are imported by `@/layouts/main/main.css` so they stay loaded
// for the shared main-layout chrome across client-side route transitions.

export const DrawerPosition = {
  LEFT: "left",
  RIGHT: "right",
  TOP: "top",
  BOTTOM: "bottom",
} as const

export type DrawerPosition =
  (typeof DrawerPosition)[keyof typeof DrawerPosition]

export interface DrawerProps {
  side?: DrawerPosition
  open?: boolean
  onOpenChange?: (open: boolean) => void
  class?: string
  contentRef?: (element: HTMLElement) => void
  drawerProps?: Omit<ComponentProps<typeof DrawerPrimitive>, "children">

  showTrigger?: boolean
  Trigger?: ValidComponent
  triggerIcon?: string
  triggerClass?: string
  triggerIconClass?: string

  showClose?: boolean
  Close?: ValidComponent
  closeClass?: string
  closeIcon?: string
  closeIconClass?: string
  closeAriaLabel?: string

  Header?: ValidComponent
  headerClass?: string
  title?: string | string[]
  titleClass?: string
  subtitle?: string
  subtitleClass?: string

  contentClass?: string
  children: ValidComponent | Component | JSX.Element | HTMLElement
}

const resolveTriggerIcon = (position: DrawerPosition) => {
  const triggerIconPositions = {
    [DrawerPosition.LEFT]: "menu_open",
    [DrawerPosition.RIGHT]: "menu_open",
    [DrawerPosition.TOP]: "top_panel_open",
    [DrawerPosition.BOTTOM]: "top_panel_open",
  }

  return triggerIconPositions[position]
}

export function Drawer(props: DrawerProps) {
  const propsWithDefaults = mergeProps(
    {
      side: DrawerPosition.RIGHT,
      open: false,
      onOpenChange: () => {},
      showTrigger: true,
      triggerIcon: resolveTriggerIcon(props.side || DrawerPosition.RIGHT),
      showClose: true,
      closeIcon: "close",
      closeAriaLabel: "Close",
    },
    props,
  )

  const [local] = splitProps(propsWithDefaults, [
    "side",
    "open",
    "onOpenChange",
    "class",
    "contentRef",
    "drawerProps",
    "showTrigger",
    "Trigger",
    "triggerIcon",
    "triggerClass",
    "triggerIconClass",
    "showClose",
    "Close",
    "closeClass",
    "closeIcon",
    "closeIconClass",
    "closeAriaLabel",
    "Header",
    "headerClass",
    "title",
    "titleClass",
    "subtitle",
    "subtitleClass",
    "contentClass",
    "children",
  ])

  const hasTrigger = createMemo(
    () =>
      local.showTrigger &&
      (isNotEmpty(local.Trigger) || isNotEmpty(local.triggerIcon)),
  )

  // Render the trigger based on what was provided
  const renderTrigger = () => {
    if (!hasTrigger()) {
      return null
    }

    // If custom Trigger is provided, use it
    if (local.Trigger) {
      if (typeof local.Trigger === "function") {
        // If it's a function, call it with the trigger props
        return local.Trigger({
          as: DrawerPrimitive.Trigger,
          class: cx("drawer-trigger", local.triggerClass),
        })
      } else {
        // If it's a component, render it wrapped in DrawerTrigger
        const TriggerComponent = local.Trigger as any
        return (
          <DrawerPrimitive.Trigger
            class={cx("drawer-trigger", local.triggerClass)}>
            <TriggerComponent />
          </DrawerPrimitive.Trigger>
        )
      }
    }

    // If no custom trigger but we have triggerIcon, render default icon trigger
    if (local.triggerIcon) {
      return (
        <DrawerPrimitive.Trigger
          class={cx("drawer-trigger", local.triggerClass)}>
          <Icon
            name={local.triggerIcon}
            class={local.triggerIconClass}
          />
        </DrawerPrimitive.Trigger>
      )
    }

    // No trigger provided
    return null
  }

  const renderClose = () => {
    if (!local.showClose) {
      return null
    }

    if (local.Close) {
      const CloseComponent = local.Close as any
      return (
        <DrawerPrimitive.Close
          aria-label={local.closeAriaLabel}
          class={cx("drawer-close", local.closeClass)}>
          <CloseComponent />
        </DrawerPrimitive.Close>
      )
    }

    if (local.closeIcon) {
      return (
        <DrawerPrimitive.Close
          aria-label={local.closeAriaLabel}
          class={cx("drawer-close drawer-close--icon", local.closeClass)}>
          <Icon
            name={local.closeIcon}
            class={cx(local.closeIconClass)}
          />
        </DrawerPrimitive.Close>
      )
    }

    return null
  }

  // Render header
  const renderHeader = () => {
    if (local.Header) {
      const HeaderComponent = local.Header as any
      return <HeaderComponent />
    }

    if (local.title || local.subtitle) {
      return (
        <header class={cx("drawer-header", local.headerClass)}>
          {local.title ? (
            <DrawerPrimitive.Label class={cx("drawer-title", local.titleClass)}>
              {local.title}
            </DrawerPrimitive.Label>
          ) : null}
          {local.subtitle ? (
            <DrawerPrimitive.Description
              class={cx("drawer-subtitle", local.subtitleClass)}>
              {local.subtitle}
            </DrawerPrimitive.Description>
          ) : null}
        </header>
      )
    }

    return null
  }

  return (
    <DrawerPrimitive
      side={local.side}
      open={local.open}
      onOpenChange={open => local.onOpenChange(open)}
      {...local.drawerProps}>
      {renderTrigger()}
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay />
        <DrawerPrimitive.Content
          as="aside"
          ref={element => local.contentRef?.(element as HTMLElement)}
          class={cx(
            "drawer-content",
            local.side,
            local.class,
            local.contentClass,
          )}>
          {renderHeader()}
          {local.children as any}
          {renderClose()}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive>
  )
}
