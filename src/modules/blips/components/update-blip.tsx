import type { Blip } from "@/modules/blips/data/schema"
import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import "./update-blip.css"

export function UpdateBlip(props: {
  blip: Blip
  isRecentRealtime?: boolean
  isShimmering?: boolean
  onEdit?: (blipId: string) => void
}) {
  const [timeTick, setTimeTick] = createSignal(Date.now())
  const timestampLabel = createMemo(() => {
    timeTick()
    return formatBlipTimestamp(props.blip.created_at)
  })

  onMount(() => {
    const intervalId = setInterval(() => {
      setTimeTick(Date.now())
    }, 60_000)

    onCleanup(() => {
      clearInterval(intervalId)
    })
  })

  return (
    <li
      class="update-blip"
      classList={{
        "update-blip--recent-realtime": props.isRecentRealtime === true,
        "update-blip--shimmering": props.isShimmering === true,
        "update-blip--unpublished": !props.blip.published,
      }}>
      <header class="update-blip-header">
        <span class="update-blip-timestamp">
          {timestampLabel()}
        </span>
      </header>
      <div class="update-blip-content">
        <Markdown content={props.blip.content ?? ""} />
      </div>
      <footer class="update-blip-footer">
        <BlipActions
          blip={props.blip}
          onEdit={props.onEdit}
        />
      </footer>
    </li>
  )
}
