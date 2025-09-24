import { JSX, splitProps, For, Show } from "solid-js"
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { Icon } from "@/components/icon"
import { IconButton, IconButtonSize } from "@/components/icon-button"
import { clsx as cx, isNotEmpty } from "@/util"
import "./menu.css"

type MenuItem = {
  icon?: string
  label: string
  onClick: () => void
}

type MenuProps = {
  Trigger?: JSX.Element | (() => JSX.Element)
  triggerIcon?: string
  triggerButtonSize?: IconButtonSize
  triggerClass?: string
  items: MenuItem[]
  Header?: JSX.Element | (() => JSX.Element)
  Footer?: JSX.Element | (() => JSX.Element)
}

export function Menu(props: MenuProps) {
  const propsWithDefaults = {
    triggerIcon: "more_vert" as string,
    triggerButtonSize: "md" as IconButtonSize,
    ...props,
  }

  const [local] = splitProps(propsWithDefaults, [
    "Trigger",
    "triggerIcon",
    "triggerButtonSize",
    "triggerClass",
    "items",
    "Header",
    "Footer",
  ])

  const renderTrigger = () => {
    if (isNotEmpty(local.Trigger)) {
      if (typeof local.Trigger === "function") {
        return local.Trigger()
      }

      return local.Trigger
    }

    return (
      <IconButton
        icon={local.triggerIcon}
        size={local.triggerButtonSize}
      />
    )
  }

  const renderHeader = () => {
    if (isNotEmpty(local.Header)) {
      if (typeof local.Header === "function") {
        return local.Header()
      }

      return local.Header
    }
  }

  const renderFooter = () => {
    if (isNotEmpty(local.Footer)) {
      if (typeof local.Footer === "function") {
        return local.Footer()
      }

      return local.Footer
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger class={cx("menu-trigger", local.triggerClass)}>
        {renderTrigger()}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu content">
          <DropdownMenu.Arrow class="menu arrow" />
          <Show when={isNotEmpty(local.Header)}>
            <header class="menu-header">{renderHeader()}</header>
            <DropdownMenu.Separator class="menu-separator" />
          </Show>
          <For each={local.items}>
            {item => (
              <DropdownMenu.Item
                class="menu-item"
                onClick={item.onClick}>
                {item.icon ? <Icon name={item.icon} /> : null}
                <span class="menu-item-label">{item.label}</span>
              </DropdownMenu.Item>
            )}
          </For>
          <Show when={isNotEmpty(local.Footer)}>
            <DropdownMenu.Separator class="menu-separator" />
            <footer class="menu-footer">{renderFooter()}</footer>
          </Show>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
