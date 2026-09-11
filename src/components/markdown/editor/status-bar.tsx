import {
  mergeProps,
  splitProps,
  Show,
  type JSX,
  type Component,
} from "solid-js"
import { clsx as cx } from "@/util"
import { Icon } from "@/components/icon"
import { blurControl, preventControlFocus } from "./prevent-control-focus"
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
  const [local] = splitProps(propsWithDefaults, [
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
          tabIndex={-1}
          class="toggle-toolbar"
          onClick={() => local.onToggleToolbar()}
          onMouseDown={preventControlFocus}
          onPointerUp={blurControl}>
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
