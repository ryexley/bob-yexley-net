import { JSX, splitProps, For, Show, ComponentProps } from "solid-js"
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { Icon } from "@/components/icon"
import { IconButtonSize } from "@/components/icon-button"
import { clsx as cx, isNotEmpty } from "@/util"
import "./menu.css"

type MenuItem = {
  icon?: string
  iconNode?: JSX.Element
  label: string
  onClick: () => void
  menuItemProps?: ComponentProps<typeof DropdownMenu.Item>
}

type MenuProps = {
  Trigger?: JSX.Element | (() => JSX.Element)
  triggerIcon?: string
  triggerButtonSize?: IconButtonSize
  triggerClass?: string
  items: MenuItem[]
  Header?: JSX.Element | (() => JSX.Element)
  Footer?: JSX.Element | (() => JSX.Element)
  dropdownMenuProps?: ComponentProps<typeof DropdownMenu>
}

export function Menu(props: MenuProps) {
  const propsWithDefaults = {
    triggerIcon: "more_vert" as string,
    triggerButtonSize: "md" as IconButtonSize,
    modal: true,
    ...props,
  }

  const [local, rest] = splitProps(propsWithDefaults, [
    "Trigger",
    "triggerIcon",
    "triggerButtonSize",
    "triggerClass",
    "items",
    "Header",
    "Footer",
    "dropdownMenuProps",
  ])

  const triggerClass = cx("menu-trigger", local.triggerButtonSize, local.triggerClass)

  const renderTrigger = () => {
    if (isNotEmpty(local.Trigger)) {
      if (typeof local.Trigger === "function") {
        return local.Trigger()
      }

      return local.Trigger
    }

    return (
      <Icon name={local.triggerIcon} />
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
    <DropdownMenu {...local.dropdownMenuProps}>
      <DropdownMenu.Trigger class={triggerClass}>
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
                textValue={item.label}
                onSelect={item.onClick}
                {...item.menuItemProps}>
                {item.iconNode || (item.icon ? <Icon name={item.icon} /> : null)}
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
