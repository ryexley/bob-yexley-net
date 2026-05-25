import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
  type JSX,
} from "solid-js"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { Icon } from "@/components/icon"
import { withWindow } from "@/util/browser"
import { cx } from "@/util"
import "./form-drawer.css"

const CLOSE_ANIMATION_MS = 500

export type FormDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  closeAriaLabel?: string
  class?: string
  contentClass?: string
  actionsClass?: string
  when?: boolean
  canDismiss?: () => boolean
  onContentRef?: (element: HTMLElement) => void
  onClosed?: () => void
  actions: JSX.Element
  children: JSX.Element
}

export function FormDrawer(props: FormDrawerProps) {
  const [isMounted, setIsMounted] = createSignal(false)
  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null)
  let closeUnmountTimeout: ReturnType<typeof setTimeout> | null = null

  const drawerBehavior = createMemo(() => ({
    closeOnEscapeKeyDown: false,
    closeOnOutsidePointer: false,
    closeOnOutsideFocus: false,
    snapPoints: [1],
    breakPoints: [],
    defaultSnapPoint: 1,
  }))

  const requestClose = () => {
    if (props.canDismiss?.() === false) {
      return
    }

    props.onOpenChange(false)
  }

  const clearCloseUnmountTimeout = () => {
    if (closeUnmountTimeout) {
      clearTimeout(closeUnmountTimeout)
      closeUnmountTimeout = null
    }
  }

  createEffect(() => {
    if (props.open) {
      clearCloseUnmountTimeout()
      setIsMounted(true)
      return
    }

    if (!isMounted()) {
      return
    }

    clearCloseUnmountTimeout()
    closeUnmountTimeout = setTimeout(() => {
      setIsMounted(false)
      props.onClosed?.()
      closeUnmountTimeout = null
    }, CLOSE_ANIMATION_MS)
  })

  createEffect(() => {
    if (!props.open || props.canDismiss?.() === false) {
      return
    }

    const content = contentElement()
    if (!content) {
      return
    }

    withWindow(window => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return
        }

        event.preventDefault()
        requestClose()
      }

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target
        if (!(target instanceof Node) || content.contains(target)) {
          return
        }

        requestClose()
      }

      window.document.addEventListener("keydown", handleKeyDown)
      window.document.addEventListener("pointerdown", handlePointerDown, true)

      onCleanup(() => {
        window.document.removeEventListener("keydown", handleKeyDown)
        window.document.removeEventListener("pointerdown", handlePointerDown, true)
      })
    })
  })

  onCleanup(() => {
    clearCloseUnmountTimeout()
  })

  const handleContentRef = (element: HTMLElement) => {
    setContentElement(element)
    props.onContentRef?.(element)
  }

  return (
    <Show when={isMounted() && (props.when ?? true)}>
      <Drawer
        side={DrawerPosition.RIGHT}
        open={props.open}
        onOpenChange={open => props.onOpenChange(open)}
        contentRef={handleContentRef}
        showTrigger={false}
        showClose={false}
        drawerProps={drawerBehavior()}
        class={cx("form-drawer", props.class)}
        title={props.title}
        closeAriaLabel={props.closeAriaLabel ?? "Close"}>
        <button
          type="button"
          class="form-drawer-close"
          aria-label={props.closeAriaLabel ?? "Close"}
          onClick={() => requestClose()}>
          <Icon name="chevron_right" />
        </button>
        <div class="form-drawer-body">
          <div class={props.contentClass ?? "form-drawer-content"}>{props.children}</div>
          <footer class={props.actionsClass ?? "form-drawer-actions"}>{props.actions}</footer>
        </div>
      </Drawer>
    </Show>
  )
}
