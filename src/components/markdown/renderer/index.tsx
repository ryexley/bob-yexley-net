import { marked } from "marked"
import { createMemo, splitProps } from "solid-js"
import { clsx as cx } from "@/util"
import { blipMarkedOptions } from "./marked-blips"
import "./styles.css"

type MarkdownRendererProps = {
  content: string
  class?: string
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  const [local] = splitProps(props, ["content", "class"])

  const html = createMemo(() => {
    return marked.parse(local.content || "", blipMarkedOptions) as string
  })

  return (
    <div
      class={cx("rendered-markdown", local.class)}
      innerHTML={html()}
    />
  )
}
