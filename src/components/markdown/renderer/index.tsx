import { createMemo, splitProps } from "solid-js"
import { clsx as cx } from "@/util"
import { parseBlipMarkdown } from "./marked-blips"
import "./styles.css"

type MarkdownRendererProps = {
  content: string
  class?: string
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  const [local] = splitProps(props, ["content", "class"])

  const html = createMemo(() => {
    return parseBlipMarkdown(local.content || "")
  })

  return (
    <div
      class={cx("rendered-markdown", local.class)}
      innerHTML={html()}
    />
  )
}
