import { For, Show } from "solid-js"
import { Icon } from "@/components/icon"
import "./header.css"

export type HeaderAction = {
  label: string
  icon?: string
  onClick: () => void
  variant?: "primary" | "secondary" | "danger"
  disabled?: boolean
}

type HeaderProps = {
  title?: string
  actions?: HeaderAction[]
  showDivider?: boolean
}

export function Header(props: HeaderProps) {
  const getButtonClass = (action: HeaderAction) => {
    const baseClass = "header-action"
    const variantClass = action.variant ? `${baseClass}--${action.variant}` : ""
    const disabledClass = action.disabled ? `${baseClass}--disabled` : ""
    return [baseClass, variantClass, disabledClass].filter(Boolean).join(" ")
  }

  return (
    <div class="markdown-editor-header">
      <div class="header-content">
        <Show when={props.title}>
          <h3 class="header-title">{props.title}</h3>
        </Show>
        <Show when={props.actions && props.actions.length > 0}>
          <div class="header-actions">
            <For each={props.actions}>
              {action => (
                <button
                  type="button"
                  class={getButtonClass(action)}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  onMouseDown={e => e.preventDefault()}>
                  <Show when={action.icon}>
                    <Icon name={action.icon!} />
                  </Show>
                  <span>{action.label}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <Show when={props.showDivider !== false}>
        <div class="header-divider" />
      </Show>
    </div>
  )
}
