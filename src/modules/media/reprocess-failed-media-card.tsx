import { createSignal, Show } from "solid-js"
import { Button } from "@/components/button"
import { Icon } from "@/components/icon"
import { ptr } from "@/i18n"
import {
  reprocessAllFailedMedia,
  type ReprocessProgress,
} from "./reprocess-client"

const tr = ptr("admin.views.index.cards.media")

/**
 * Admin card that backfills WebP variants for images whose upload-time
 * processing failed. The server re-checks the session and admin role.
 */
export function ReprocessFailedMediaCard() {
  const [running, setRunning] = createSignal(false)
  const [progress, setProgress] = createSignal<ReprocessProgress | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const run = async () => {
    setRunning(true)
    setError(null)
    setProgress(null)
    try {
      await reprocessAllFailedMedia(setProgress)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div class="card media-card">
      <div class="card-header">
        <Icon
          name="images"
          class="icon"
        />
        <h2 class="card-title">{tr("title")}</h2>
      </div>
      <div class="copy">
        <p class="description">{tr("description")}</p>
      </div>
      <div class="bubbles">
        <Button
          size="sm"
          variant="secondary"
          icon="refreshCw"
          label={running() ? tr("running") : tr("action")}
          disabled={running()}
          onClick={run}
          data-testid="reprocess-failed-media"
        />
      </div>
      <Show when={progress()}>
        {current => (
          <p
            class="description"
            role="status"
            data-testid="reprocess-failed-media-status">
            {tr("status", {
              reprocessed: current().reprocessed,
              failed: current().failed.length,
              remaining: current().remaining,
            })}
          </p>
        )}
      </Show>
      <Show when={error()}>
        {message => (
          <p
            class="description"
            role="alert">
            {tr("error", { message: message() })}
          </p>
        )}
      </Show>
    </div>
  )
}
