import { Show, splitProps } from "solid-js"
import { isNotEmpty } from "@/util"

export function MapLink(props) {
  const [local, others] = splitProps(props, ["url", "children"])

  return (
    <Show when={isNotEmpty(local.url)}>
      <a
        href={local.url}
        target="_blank"
        rel="noopener noreferrer"
        {...others}>
        {local.children}
      </a>
    </Show>
  )
}
