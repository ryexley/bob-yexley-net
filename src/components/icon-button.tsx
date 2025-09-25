import { splitProps } from "solid-js"
import { Button as KobalteButton } from "@kobalte/core/button"
import { Icon } from "@/components/icon"
import { cx } from "@/util"
import "./icon-button.css"

export type IconButtonSize = "xs" | "sm" | "md" | "lg"

export type IconButtonProps = {
  icon: string
  size?: IconButtonSize
  class?: string
  iconClass?: string
  "aria-label"?: string
  onClick?: () => void
  onMouseDown?: (e: MouseEvent | TouchEvent) => void
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
    "onMouseDown",
  ])

  return (
    <KobalteButton
      class={cx("icon-button", local.size, local.class)}
      onClick={local.onClick}
      onMouseDown={local.onMouseDown}
      disabled={local.disabled}
      {...attrs}>
      <Icon
        name={local.icon}
        class={local.iconClass}
      />
    </KobalteButton>
  )
}
