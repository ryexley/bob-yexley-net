import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js"
import { render } from "solid-js/web"
import { AudioPlayer } from "@/components/audio-player"
import { clsx as cx } from "@/util"
import { ScriptureReference } from "@/modules/blips/components/scripture-reference"
import { InlineBlipMedia } from "@/modules/media/inline-blip-media"
import { XEmbed } from "@/components/markdown/x/x-embed"
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
import { mountMarkdownXEmbeds, unmountMarkdownXEmbeds } from "./mount-x-embeds"
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
  let mountGeneration = 0
  const [canMount, setCanMount] = createSignal(false)

  const html = createMemo(() => {
    return parseBlipMarkdown(local.content || "")
  })

  const unmountInteractive = () => {
    if (!containerRef) {
      return
    }
    unmountMarkdownAudioPlayers(containerRef)
    unmountMarkdownMediaEmbeds(containerRef)
    unmountMarkdownScriptureReferences(containerRef)
    unmountMarkdownXEmbeds(containerRef)
  }

  // `render()` into a mount point while Solid is still hydrating the route
  // steals hydration keys. On iPhone that shows up as `t is not a function`
  // on /blips, where every card mounts inline media after a streamed fetch.
  onMount(() => {
    setCanMount(true)
  })

  createEffect(() => {
    if (!canMount()) {
      return
    }

    const generation = ++mountGeneration
    html()

    queueMicrotask(() => {
      if (generation !== mountGeneration || !containerRef) {
        return
      }

      mountMarkdownAudioPlayers(containerRef, (playerProps, target) =>
        render(() => <AudioPlayer {...playerProps} />, target),
      )

      // Read `media` / `onOpenMedia` inside the live tree so a later media
      // fetch updates the embed in place. Tracking them in this effect would
      // unmount and remount the image (list cards load rows after first paint).
      mountMarkdownMediaEmbeds(containerRef, (embed, target) =>
        render(
          () => (
            <InlineBlipMedia
              embed={embed}
              record={local.media?.find(row => row.storage_key === embed.key)}
              onOpen={local.onOpenMedia}
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

      mountMarkdownXEmbeds(containerRef, (embed, target) =>
        render(() => <XEmbed {...embed} />, target),
      )
    })

    onCleanup(() => {
      mountGeneration += 1
      unmountInteractive()
    })
  })

  onCleanup(() => {
    mountGeneration += 1
    unmountInteractive()
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
