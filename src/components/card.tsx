import { splitProps } from "solid-js"
import { Stack } from "@/components/stack"
import { Icon } from "@/components/icon"
import { cn } from "@/lib/util"
import { isNotEmpty } from "@/util"

type CardProps = {
  icon?: string
  title?: string
  subtitle?: string
  children: any
  class?: string
}

export function Card(props: CardProps) {
  const [local] = splitProps(props, [
    "icon",
    "title",
    "subtitle",
    "children",
    "class",
  ])

  return (
    <div
      class={cn(
        "border-[0.0625rem] border-[var(--colors-mono-02)] rounded-md p-4 shadow-[0_1.25rem_1.5625rem_-0.3125rem_#0000001a,0_0.5rem_0.625rem_-0.375rem_#0000001a] shadow-black/50 min-w-[21.875rem] transition-[var(--transitions-primary)]",
        local.class,
      )}>
      <Stack gap="0">
        <Stack
          orient="row"
          align="center">
          {isNotEmpty(local.icon) ? (
            <Icon
              name={local.icon}
              class="text-[var(--colors-cool-blue)]"
            />
          ) : null}
          {isNotEmpty(local.title) ? (
            <h2 class="text-xl font-bold">{local.title}</h2>
          ) : null}
        </Stack>
        {isNotEmpty(local.subtitle) ? (
          <p class="text-xs text-[var(--colors-mono-09)]">{local.subtitle}</p>
        ) : null}
      </Stack>
      <div>{local.children}</div>
    </div>
  )
}
