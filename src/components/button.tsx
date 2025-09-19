import { ComponentProps, splitProps } from "solid-js"
import { Button as KobalteButton } from "@kobalte/core/button"
import { Icon } from "@/components/icon"
import { cn } from "@/lib/util"
import { isNotEmpty } from "@/util"

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  label: string
  icon?: string
} & Omit<ComponentProps<typeof KobalteButton>, "children">

function getButtonClasses(variant = "primary", size = "md") {
  const baseClasses =
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold! transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [text-shadow:0_0_0.1875rem_rgba(0,0,0,0.85)]"

  const variants = {
    primary:
      "bg-[var(--colors-cool-blue)] text-[var(--colors-mono-11)] hover:bg-[rgba(var(--colors-cool-blue-rgb),0.8)]",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
    outline: "border border-gray-300 bg-transparent hover:bg-gray-50",
    ghost: "hover:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }

  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4",
    lg: "h-12 px-6 text-lg",
  }

  return cn(baseClasses, variants[variant], sizes[size])
}

export function Button(props: ButtonProps) {
  const [local, attrs] = splitProps(props, [
    "label",
    "class",
    "variant",
    "size",
    "icon",
  ])

  return (
    <KobalteButton
      class={cn(getButtonClasses(local.variant, local.size), local.class)}
      {...attrs}>
      {isNotEmpty(local.icon) ? <Icon name={local.icon!} /> : null}
      {local.label}
    </KobalteButton>
  )
}
