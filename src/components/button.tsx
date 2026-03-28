import { ComponentProps, JSX, splitProps } from "solid-js"
import { Button as KobalteButton } from "@kobalte/core/button"
import { Icon } from "@/components/icon"
import { cx } from "@/util"
import { isNotEmpty } from "@/util"
import "./button.css"

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger"
type ButtonSize = "xs" | "sm" | "md" | "lg"

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  label: string | JSX.Element
  icon?: string
  iconRight?: string
} & Omit<ComponentProps<typeof KobalteButton>, "children">

export function Button(props: ButtonProps) {
  const [local, attrs] = splitProps(props, [
    "label",
    "class",
    "variant",
    "size",
    "icon",
    "iconRight",
  ])

  const variant = local.variant || "primary"
  const size = local.size || "md"

  return (
    <KobalteButton
      class={cx("button", variant, size, local.class)}
      {...attrs}>
      {isNotEmpty(local.icon) ? <Icon name={local.icon!} /> : null}
      {local.label}
      {isNotEmpty(local.iconRight) ? <Icon name={local.iconRight!} /> : null}
    </KobalteButton>
  )
}
