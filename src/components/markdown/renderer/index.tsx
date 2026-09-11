import { createEffect, createMemo, onCleanup, splitProps } from "solid-js"
import { render } from "solid-js/web"
import { AudioPlayer } from "@/components/audio-player"
import { clsx as cx } from "@/util"
import { ScriptureReference } from "@/modules/blips/components/scripture-reference"
import { InlineBlipMedia } from "@/modules/media/inline-blip-media"
import type { BlipMediaRow } from "@/modules/media/data/queries"
import {
  mountMarkdownAudioPlayers,
  unmountMarkdownAudioPlayers,
} from "./mount-audio-players"
import {
  mountMarkdownMediaEmbeds,
  unmountMarkdownMediaEmbeds,
} from "./mount-media-embeds"
import {
  mountMarkdownScriptureReferences,
  unmountMarkdownScriptureReferences,
} from "./mount-scripture-references"
import { parseBlipMarkdown } from "./marked-blips"
import "./styles.css"

type MarkdownRendererProps = {
  content: string
  class?: string
  media?: BlipMediaRow[]
  onOpenMedia?: (record: BlipMediaRow) => void
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  const [local] = splitProps(props, [
    "content",
    "class",
    "media",
    "onOpenMedia",
  ])
  let containerRef: HTMLDivElement | undefined

  const html = createMemo(() => {
    return parseBlipMarkdown(local.content || "")
  })

  createEffect(() => {
    html()
    const media = local.media
    const onOpenMedia = local.onOpenMedia

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

      mountMarkdownMediaEmbeds(containerRef, (embed, target) =>
        render(
          () => (
            <InlineBlipMedia
              embed={embed}
              record={media?.find(row => row.storage_key === embed.key)}
              onOpen={onOpenMedia}
            />
          ),
          target,
        ),
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
        unmountMarkdownMediaEmbeds(containerRef)
        unmountMarkdownScriptureReferences(containerRef)
      }
    })
  })

  onCleanup(() => {
    if (containerRef) {
      unmountMarkdownAudioPlayers(containerRef)
      unmountMarkdownMediaEmbeds(containerRef)
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
