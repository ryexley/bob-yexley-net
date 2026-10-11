import { createSignal, onMount, Show } from "solid-js"
import { revalidate } from "@solidjs/router"
import { Button } from "@/components/button"
import { ptr } from "@/i18n"
import "./route-boundary.css"

const tr = ptr("shared.components.routeBoundary")

/**
 * Shown while a route's data is still resolving. It should be rare: a
 * server-rendered first load hydrates from the server's HTML without ever
 * rendering a fallback, and client navigations run inside a router transition
 * that holds the previous page on screen. What is left is the occasional
 * unexpected suspension, where the point is simply to look alive rather than
 * blank.
 */
export function RouteFallback() {
  return (
    <div
      class="route-boundary"
      role="status"
      aria-live="polite">
      <span
        class="route-boundary__spinner"
        aria-hidden="true"
      />
      <p class="route-boundary__message">{tr("loading")}</p>
    </div>
  )
}

export function RouteError(props: { error: unknown; onReset: () => void }) {
  const [retrying, setRetrying] = createSignal(false)

  const detail = () =>
    props.error instanceof Error ? props.error.message : String(props.error ?? "")
  const stack = () => (props.error instanceof Error ? (props.error.stack ?? "") : "")

  // Minified production messages (`t is not a function`) say nothing on their
  // own; log the whole error so the stack is there to map back to source.
  onMount(() => console.error("Route error boundary caught:", props.error))

  const retry = async () => {
    setRetrying(true)

    try {
      // `onReset` alone re-renders straight back into the same failed cache
      // entry, which throws again and lands right back here. Dropping the
      // cached failures first is what makes this button actually retry.
      await revalidate()
    } catch (error: unknown) {
      console.error("Retry after a route error failed:", error)
    }

    setRetrying(false)
    props.onReset()
  }

  return (
    <div class="route-boundary">
      <p class="route-boundary__title">{tr("errorTitle")}</p>
      <p class="route-boundary__message">{tr("errorBody")}</p>
      <Show when={detail()}>
        <p class="route-boundary__detail">{detail()}</p>
      </Show>
      <Show when={stack()}>
        <details class="route-boundary__stack">
          <summary>{tr("errorStack")}</summary>
          <pre>{stack()}</pre>
        </details>
      </Show>
      <Button
        variant="secondary"
        label={retrying() ? tr("retrying") : tr("retry")}
        disabled={retrying()}
        onClick={() => void retry()}
      />
    </div>
  )
}
