import {
  mergeProps,
  splitProps,
  Show,
  type JSX,
  type Component,
} from "solid-js"
import { clsx as cx } from "@/util"
import { Icon } from "@/components/icon"
import "./status-bar.css"

type StatusBarProps = {
  onToggleToolbar: () => void
  statusText?: string
  statusIcon?: JSX.Element
  showStatus?: boolean
  statusFading?: boolean
  actions?: Component<any>
  context?: any
}

const propDefaults = {
  onToggleToolbar: () => {},
}

export function StatusBar(props: StatusBarProps) {
  const propsWithDefaults = mergeProps(propDefaults, props)
  const [local, attrs] = splitProps(propsWithDefaults, [
    "onToggleToolbar",
    "statusText",
    "statusIcon",
    "showStatus",
    "statusFading",
    "actions",
    "context",
  ])

  return (
    <div class="status-bar">
      <Show
        when={local.showStatus && local.statusText}
        fallback={<span />}>
        <div
          class={cx("status-bar-status", { "fade-out": local.statusFading })}>
          {local.statusIcon}
          <span class="status-text">{local.statusText}</span>
        </div>
      </Show>
      <div class="status-bar-actions">
        <button
          type="button"
          class="toggle-toolbar"
          onClick={local.onToggleToolbar}
          // Prevent this button from stealing focus
          // which causes the soft keyboard to close
          // when it is open on mobile devices and the
          // user taps this button to toggle the toolbar
          onMouseDown={e => e.preventDefault()}>
          <Icon name="format_bold" />
          <Icon name="format_italic" />
          <Icon name="format_underlined" />
        </button>
        <Show when={local.actions}>
          <div class="status-bar-divider" />
          {local.actions?.(local.context)}
        </Show>
      </div>
    </div>
  )
}
