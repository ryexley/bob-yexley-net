import { splitProps } from "solid-js"
import { Button as KobalteButton } from "@kobalte/core/button"
import { Icon } from "@/components/icon"
import { cx } from "@/util"
import "./icon-button.css"

export type IconButtonSize = "sm" | "md" | "lg"

export type IconButtonProps = {
  icon: string
  size?: IconButtonSize
  class?: string
  iconClass?: string
  onClick?: () => void
  disabled?: boolean
}

export function IconButton(props: IconButtonProps) {
  const propsWithDefaults = {
    size: "md" as IconButtonSize,
    ...props,
  }

  const [local, attrs] = splitProps(propsWithDefaults, [
    "icon",
    "size",
    "class",
    "iconClass",
    "onClick",
    "disabled",
  ])

  return (
    <KobalteButton
      class={cx("icon-button", local.size, local.class)}
      onClick={local.onClick}
      disabled={local.disabled}
      {...attrs}>
      <Icon
        name={local.icon}
        class={local.iconClass}
      />
    </KobalteButton>
  )
}
