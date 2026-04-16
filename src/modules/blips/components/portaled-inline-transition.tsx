import { Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { Transition } from "solid-transition-group"
import { clsx as cx } from "@/util"
import "./portaled-inline-transition.css"

type PortaledInlineTransitionProps = {
  mount?: HTMLDivElement | null
  open: boolean
  class?: string
  onAfterExit?: () => void
  children: JSX.Element
}

export function PortaledInlineTransition(props: PortaledInlineTransitionProps) {
  return (
    <Show when={props.mount}>
      {mount => (
        <Portal mount={mount()}>
          <Transition
            name="blip-inline-transition"
            appear
            onAfterExit={() => props.onAfterExit?.()}>
            {props.open ? (
              <div class="blip-inline-transition">
                <div class={cx(props.class)}>{props.children}</div>
              </div>
            ) : null}
          </Transition>
        </Portal>
      )}
    </Show>
  )
}
