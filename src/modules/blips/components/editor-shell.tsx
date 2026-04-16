import { Show, type JSX } from "solid-js"
import { Icon } from "@/components/icon"
import { clsx as cx } from "@/util"

type EditorShellProps = {
  children: JSX.Element
  focusProxyAriaLabel: string
  icon?: string
  focusProxyRef?: (element: HTMLTextAreaElement) => void
  showFocusProxy?: boolean
  Header?: JSX.Element
  PortalLayer?: JSX.Element
  bodyClass?: string
  frameClass?: string
  shellClass?: string
  transitionClass?: string
  isOpen?: boolean
}

function EditorShellSurface(props: EditorShellProps) {
  return (
    <div class={cx("blip-editor-shell", props.shellClass)}>
      <Show when={props.showFocusProxy ?? true}>
        {/* iOS Safari is more willing to keep the soft keyboard attached to the
            opening tap when focus first lands on a real text control. We focus
            this hidden textarea during open, then immediately hand off to
            Milkdown/ProseMirror once the editor is mounted and ready. */}
        <textarea
          ref={element => props.focusProxyRef?.(element)}
          class="blip-editor-focus-proxy"
          tabIndex={-1}
          aria-label={props.focusProxyAriaLabel}
        />
      </Show>
      <Show when={props.icon}>
        <Icon
          name={props.icon!}
          class="editor-shell-icon"
        />
      </Show>
      <Show when={props.Header}>{props.Header}</Show>
      <div class={cx("blip-editor-body", props.bodyClass)}>{props.children}</div>
      <Show when={props.PortalLayer}>{props.PortalLayer}</Show>
    </div>
  )
}

export function EditorShell(props: EditorShellProps) {
  return (
    <div class={cx("blip-editor-frame", props.frameClass)}>
      <Show
        when={props.transitionClass}
        fallback={<EditorShellSurface {...props} />}>
        <div
          class={props.transitionClass}
          classList={{ "is-open": Boolean(props.isOpen) }}>
          <EditorShellSurface {...props} />
        </div>
      </Show>
    </div>
  )
}
