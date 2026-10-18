import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import { ptr } from "@/i18n"
import type { XEmbedProps } from "./x-embed-syntax"
import { X_TWEET_WIDGET_OPTIONS, loadTwitterWidgets } from "./x-widgets"
import "./x-embed.css"

const tr = ptr("shared.components.xEmbed")

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
  let host: HTMLDivElement | undefined

  createEffect(() => {
    const statusId = props.id
    const target = document.createElement("div")
    host?.replaceChildren(target)
    let cancelled = false
    setStatus("loading")

    void loadTwitterWidgets()
      .then(twttr =>
        twttr.widgets.createTweet(statusId, target, X_TWEET_WIDGET_OPTIONS),
      )
      .then(element => {
        if (cancelled) {
          return
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
        ref={host}
        class="widget"
        data-x-widget=""
      />
    </>
  )
}
