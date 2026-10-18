import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import { ptr } from "@/i18n"
import type { XEmbedProps } from "./x-embed-syntax"
import { loadTwitterWidgets, tweetWidgetOptions } from "./x-widgets"
import "./x-embed.css"

const tr = ptr("shared.components.xEmbed")

function readHostWidth(host: HTMLElement): number {
  try {
    return Math.floor(host.getBoundingClientRect().width)
  } catch {
    return 0
  }
}

export function XEmbed(props: XEmbedProps) {
  return (
    <div
      class="x-embed"
      data-x-status-id={props.id}
      data-x-url={props.url}>
      <XEmbedWidget {...props} />
    </div>
  )
}

export function XEmbedWidget(props: XEmbedProps) {
  const [status, setStatus] = createSignal<"loading" | "ready" | "fallback">(
    "loading",
  )
  const [host, setHost] = createSignal<HTMLDivElement>()

  createEffect(() => {
    const statusId = props.id
    const hostEl = host()
    if (!hostEl) {
      return
    }

    const target = document.createElement("div")
    target.style.width = "100%"
    hostEl.replaceChildren(target)
    let cancelled = false
    setStatus("loading")

    void loadTwitterWidgets()
      .then(twttr => {
        if (cancelled) {
          return undefined
        }
        return twttr.widgets.createTweet(
          statusId,
          target,
          tweetWidgetOptions(readHostWidth(hostEl)),
        )
      })
      .then(element => {
        if (cancelled) {
          return
        }
        if (element instanceof HTMLElement) {
          element.style.backgroundColor = "transparent"
          element.style.colorScheme = "dark"
        }
        setStatus(element ? "ready" : "fallback")
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("fallback")
        }
      })

    onCleanup(() => {
      cancelled = true
      target.remove()
    })
  })

  return (
    <>
      <Show when={status() !== "ready"}>
        <a
          class="fallback"
          href={props.url}
          target="_blank"
          rel="noopener noreferrer">
          {status() === "loading" ? tr("loading") : tr("viewPost")}
        </a>
      </Show>
      <div
        ref={setHost}
        class="widget"
        data-x-widget=""
      />
    </>
  )
}
