import { createMemo, createSignal, splitProps } from "solid-js"
import { cva, cx, isNotEmpty } from "@/util"
import {
  Drawer as DrawerPrimitive,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  // DrawerFooter,
  DrawerLabel as DrawerTitle,
  DrawerDescription as DrawerSubtitle,
} from "@/lib/ui/drawer"
import { Icon } from "@/components/icon"

export const DRAWER_POSITION = {
  LEFT: "left",
  RIGHT: "right",
  TOP: "top",
  BOTTOM: "bottom",
}

const resolveToggleIcon = (position: string) => {
  const toggleIconPositions = {
    [DRAWER_POSITION.LEFT]: "menu_open",
    [DRAWER_POSITION.RIGHT]: "menu_open",
    [DRAWER_POSITION.TOP]: "top_panel_open",
    [DRAWER_POSITION.BOTTOM]: "top_panel_open",
  }

  return toggleIconPositions[position]
}

const toggleButtonStyles = cva(
  "drawer-toggle flex items-center justify-center h-8 w-8 rounded-md p-1 cursor-pointer",
  {
    variants: {
      position: {
        [DRAWER_POSITION.LEFT]: "rotate-180",
        [DRAWER_POSITION.RIGHT]: "",
        [DRAWER_POSITION.TOP]: "",
        [DRAWER_POSITION.BOTTOM]: "rotate-180",
      },
    },
    defaultVariants: {
      position: DRAWER_POSITION.RIGHT,
    },
  },
)

const drawerBaseStyles = cva(
  "rounded-none bg-[var(--colors-mono-01)] border border-[var(--colors-mono-02)] z-50 fixed",
  {
    variants: {
      position: {
        [DRAWER_POSITION.RIGHT]:
          "right-0 top-0 h-screen min-w-[20rem] border-l translate-x-full data-[open]:translate-x-0",
        [DRAWER_POSITION.LEFT]:
          "left-0 top-0 h-screen min-w-[20rem] border-r translate-x-full data-[open]:translate-x-0",
        [DRAWER_POSITION.TOP]: "top-0 left-0 w-screen min-h-[10rem]",
        [DRAWER_POSITION.BOTTOM]: "bottom-0 left-0 w-screen min-h-[10rem]",
      },
    },
    defaultVariants: {
      position: "right",
    },
  },
)

const contentBaseStyles = cva("drawer-content overflow-y-auto pb-4")

const closeButtonStyles = cva(
  "drawer-close absolute top-2 right-2 flex items-center justify-center h-8 w-8 p-1 rounded-md ml-4 text-xl hover:text-[var(--colors-resonant-blue)]",
)

const headerStyles = cva(
  "drawer-header flex flex-col p-4 bg-[var(--colors-mono-02)] border-b border-[var(--colors-mono-03)] flex justify-between items-start",
)

const titleStyles = cva("drawer-title text-[2rem] font-[400]")

const subtitleStyles = cva("drawer-subtitle m-0 p-0 text-sm opacity-70 mt-1")

export function Drawer(props: any) {
  const [local, rest] = splitProps(props, [
    "position",
    "open",
    "onOpenChange",
    "class",
    "showToggle",
    "toggleIcon",
    "toggleClass",
    "toggleIconClass",
    "showCloseButton",
    "closeButtonIcon",
    "closeButtonClass",
    "closeButtonIconClass",
    "showHeader",
    "title",
    "subtitle",
    "contentClass",
    "headerClass",
    "titleClass",
    "subtitleClass",
    "children",
  ])
  const isControlled = createMemo(() => isNotEmpty(local.open))
  const [controlledOpen, setControlledOpen] = createSignal(false)
  const open = createMemo(() =>
    isControlled() ? local.open : controlledOpen(),
  )
  const position = createMemo(() => local.position || DRAWER_POSITION.RIGHT)
  const showToggle = createMemo(() => local.showToggle ?? true)
  const toggleIcon = createMemo(
    () => local.toggleIcon || resolveToggleIcon(position()),
  )
  const showCloseButton = createMemo(() => local.showCloseButton ?? true)
  const closeButtonIcon = createMemo(() => local.closeButtonIcon || "close")
  const showTitle = createMemo(() => isNotEmpty(local.title))
  const showSubtitle = createMemo(() => isNotEmpty(local.subtitle))
  const showHeader = createMemo(() => {
    if (isNotEmpty(local.showHeader)) {
      return local.showHeader
    }

    return showTitle() || showSubtitle()
  })
  const drawerStyles = createMemo(() =>
    drawerBaseStyles({
      position: position(),
      class: local.class,
    }),
  )
  const contentStyles = createMemo(() =>
    contentBaseStyles({ class: cx(position(), local.contentClass) }),
  )

  const handleOpenChange = (isOpen: boolean) => {
    if (!isControlled()) {
      setControlledOpen(isOpen)
    }

    local.onOpenChange?.(isOpen)
  }

  return (
    <DrawerPrimitive
      side={position()}
      open={open()}
      onOpenChange={handleOpenChange}
      {...rest}>
      {showToggle ? (
        <DrawerTrigger
          class={toggleButtonStyles({
            position: position(),
            class: local.toggleClass,
          })}>
          <Icon
            name={toggleIcon()}
            class={local.toggleIconClass}
          />
        </DrawerTrigger>
      ) : null}
      <DrawerContent
        class={drawerStyles()}
        {...(rest as any)}>
        {showHeader() ? (
          <DrawerHeader class={headerStyles({ class: local.headerClass })}>
            {showTitle() ? (
              <DrawerTitle class={titleStyles({ class: local.titleClass })}>
                {local.title}
              </DrawerTitle>
            ) : null}
            {showSubtitle() ? (
              <DrawerSubtitle
                class={subtitleStyles({ class: local.subtitleClass })}>
                {local.subtitle}
              </DrawerSubtitle>
            ) : null}
          </DrawerHeader>
        ) : null}
        <div class={contentStyles()}>{local.children}</div>
        {showCloseButton() ? (
          <DrawerClose
            class={closeButtonStyles({ class: local.closeButtonClass })}>
            <Icon
              name={closeButtonIcon()}
              class={local.closeButtonIconClass}
            />
          </DrawerClose>
        ) : null}
      </DrawerContent>
    </DrawerPrimitive>
  )
}
