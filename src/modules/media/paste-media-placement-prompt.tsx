import { Dialog } from "@/components/dialog"
import { Button } from "@/components/button"
import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import type { MediaPlacement } from "./placement"
import "./paste-media-placement-prompt.css"

type PasteMediaPlacementPromptProps = {
  open: boolean
  isMobile: boolean
  title: string
  description: string
  inlineLabel: string
  galleryLabel: string
  cancelLabel: string
  onChoose: (placement: MediaPlacement) => void
  onCancel: () => void
}

const PRESENT_DELAY_MS = 50
const IGNORE_CLOSE_MS = 400

function PlacementChoices(props: {
  stacked: boolean
  title: string
  description: string
  inlineLabel: string
  galleryLabel: string
  cancelLabel: string
  onChoose: (placement: MediaPlacement) => void
  onCancel: () => void
}) {
  return (
    <>
      <p
        class="paste-media-placement-prompt-title"
        id="paste-media-placement-title">
        {props.title}
      </p>
      <p
        class="paste-media-placement-prompt-description"
        id="paste-media-placement-description">
        {props.description}
      </p>
      <div
        classList={{
          "paste-media-placement-prompt-actions": true,
          "paste-media-placement-prompt-actions-stacked": props.stacked,
        }}>
        <Button
          variant="primary"
          label={props.inlineLabel}
          onClick={() => props.onChoose("inline")}
        />
        <Button
          variant="primary"
          label={props.galleryLabel}
          onClick={() => props.onChoose("gallery")}
        />
        <Button
          variant="ghost"
          label={props.cancelLabel}
          onClick={props.onCancel}
        />
      </div>
    </>
  )
}

export function PasteMediaPlacementPrompt(
  props: PasteMediaPlacementPromptProps,
) {
  const [presented, setPresented] = createSignal(false)
  const [ignoreCloseUntil, setIgnoreCloseUntil] = createSignal(0)

  createEffect(() => {
    if (!props.open) {
      setPresented(false)
      setIgnoreCloseUntil(0)
      return
    }

    if (!props.isMobile) {
      setPresented(true)
      return
    }

    const presentTimer = window.setTimeout(() => {
      setPresented(true)
      setIgnoreCloseUntil(Date.now() + IGNORE_CLOSE_MS)
    }, PRESENT_DELAY_MS)

    onCleanup(() => window.clearTimeout(presentTimer))
  })

  const handleCancel = () => {
    if (Date.now() < ignoreCloseUntil()) {
      return
    }
    props.onCancel()
  }

  return (
    <Show when={props.open}>
      <Show
        when={props.isMobile}
        fallback={
          <Dialog
            open
            modal
            overlayClass="paste-media-placement-overlay"
            class="paste-media-placement-dialog"
            onOpenChange={open => {
              if (!open) {
                props.onCancel()
              }
            }}>
            <PlacementChoices
              stacked={false}
              title={props.title}
              description={props.description}
              inlineLabel={props.inlineLabel}
              galleryLabel={props.galleryLabel}
              cancelLabel={props.cancelLabel}
              onChoose={props.onChoose}
              onCancel={props.onCancel}
            />
          </Dialog>
        }>
        <Show when={presented()}>
          <div class="paste-media-placement-phone-layer">
            <div
              class="paste-media-placement-phone-overlay"
              onClick={handleCancel}
            />
            <div
              class="paste-media-placement-phone-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="paste-media-placement-title"
              aria-describedby="paste-media-placement-description"
              onClick={event => event.stopPropagation()}>
              <div
                class="paste-media-placement-phone-handle"
                aria-hidden="true"
              />
              <PlacementChoices
                stacked
                title={props.title}
                description={props.description}
                inlineLabel={props.inlineLabel}
                galleryLabel={props.galleryLabel}
                cancelLabel={props.cancelLabel}
                onChoose={props.onChoose}
                onCancel={props.onCancel}
              />
            </div>
          </div>
        </Show>
      </Show>
    </Show>
  )
}
