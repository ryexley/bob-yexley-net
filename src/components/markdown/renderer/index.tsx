import { createEffect, createMemo, onCleanup, splitProps } from "solid-js"
import { render } from "solid-js/web"
import { AudioPlayer } from "@/components/audio-player"
import { clsx as cx } from "@/util"
import { ScriptureReference } from "@/modules/blips/components/scripture-reference"
import {
  mountMarkdownAudioPlayers,
  unmountMarkdownAudioPlayers,
} from "./mount-audio-players"
import {
  mountMarkdownScriptureReferences,
  unmountMarkdownScriptureReferences,
} from "./mount-scripture-references"
import { parseBlipMarkdown } from "./marked-blips"
import "./styles.css"

type MarkdownRendererProps = {
  content: string
  class?: string
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  const [local] = splitProps(props, ["content", "class"])
  let containerRef: HTMLDivElement | undefined

  const html = createMemo(() => {
    return parseBlipMarkdown(local.content || "")
  })

  createEffect(() => {
    html()

    if (!containerRef) {
      return
    }

    queueMicrotask(() => {
      if (!containerRef) {
        return
      }

      mountMarkdownAudioPlayers(containerRef, (playerProps, target) =>
        render(() => <AudioPlayer {...playerProps} />, target),
      )

      mountMarkdownScriptureReferences(containerRef, (referenceProps, target) =>
        render(
          () => (
            <ScriptureReference
              book={referenceProps.book}
              chapter={referenceProps.chapter}
              startVerse={referenceProps.startVerse}
              endVerse={referenceProps.endVerse}
              normalized={referenceProps.normalized}>
              {referenceProps.displayText}
            </ScriptureReference>
          ),
          target,
        ),
      )
    })

    onCleanup(() => {
      if (containerRef) {
        unmountMarkdownAudioPlayers(containerRef)
        unmountMarkdownScriptureReferences(containerRef)
      }
    })
  })

  onCleanup(() => {
    if (containerRef) {
      unmountMarkdownAudioPlayers(containerRef)
      unmountMarkdownScriptureReferences(containerRef)
    }
  })

  return (
    <div
      ref={containerRef}
      class={cx("rendered-markdown", local.class)}
      // parseBlipMarkdown is the single sanitizing boundary for rendered markdown.
      // eslint-disable-next-line solid/no-innerhtml
      innerHTML={html()}
    />
  )
}
