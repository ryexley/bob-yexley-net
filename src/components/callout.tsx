import { splitProps } from "solid-js"
import { Icon } from "@/components/icon"
import { cn } from "@/lib/util"

type CalloutVariant = "info" | "warning" | "error" | "success" | "reminder"

type CalloutProps = {
  variant?: CalloutVariant
  title?: string
  content: string
  icon?: string
  class?: string
}

export function Callout(props: CalloutProps) {
  const [local, attrs] = splitProps(props, [
    "variant",
    "title",
    "content",
    "icon",
    "class",
  ])

  return (
    <div
      class={cn(
        "flex items-start gap-3 rounded-md border px-2 py-1 text-sm",
        "animate-slide-in-down",
        local.class,
      )}
      style={{
        ["border-color"]: `var(--colors-${local.variant || "info"})`,
        ["background"]: `rgba(var(--colors-${local.variant || "info"}-rgb), 0.15)`,
      }}
      {...attrs}>
      {local.icon ? (
        <Icon
          name={local.icon}
          class="mt-1 flex-shrink-0"
        />
      ) : null}
      <div class="flex flex-col">
        {local.title ? (
          <span class="text-[var(--colors-mono-11)] font-semibold">
            {local.title}
          </span>
        ) : null}
        <span class="text-[var(--colors-mono-11)]">{local.content}</span>
      </div>
    </div>
  )
}
