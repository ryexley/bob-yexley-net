import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import { Button } from "@/components/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/dialog"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { MEDIA_PLACEMENT, type MediaPlacement } from "./placement"
import "./paste-media-placement-prompt.css"

export type PasteMediaPlacementPromptProps = {
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

/**
 * Paste destination chooser. Phone-sized viewports use a bottom drawer; desktop
 * uses a dialog. Opening is deferred slightly so an iOS paste gesture cannot
 * immediately dismiss the overlay.
 */
export function PasteMediaPlacementPrompt(
  props: PasteMediaPlacementPromptProps,
) {
  const [presented, setPresented] = createSignal(false)
  let ignoreCloseUntil = 0

  createEffect(() => {
    if (!props.open) {
      setPresented(false)
      return
    }

    const timer = window.setTimeout(() => {
      ignoreCloseUntil = Date.now() + IGNORE_CLOSE_MS
      setPresented(true)
    }, PRESENT_DELAY_MS)

    onCleanup(() => window.clearTimeout(timer))
  })

  const handleOpenChange = (open: boolean) => {
    if (open || Date.now() < ignoreCloseUntil) {
      return
    }
    props.onCancel()
  }

  const actions = () => (
    <>
      <Button
        variant="secondary"
        size="sm"
        class="inline-action"
        label={props.inlineLabel}
        onClick={() => props.onChoose(MEDIA_PLACEMENT.Inline)}
      />
      <Button
        variant="primary"
        size="sm"
        class="gallery-action"
        label={props.galleryLabel}
        onClick={() => props.onChoose(MEDIA_PLACEMENT.Gallery)}
      />
    </>
  )

  return (
    <Show
      when={props.isMobile}
      fallback={
        <Dialog
          open={presented()}
          modal
          class="paste-media-placement-dialog"
          overlayClass="paste-media-placement-overlay"
          onOpenChange={handleOpenChange}>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
          <DialogFooter class="actions">
            <Button
              variant="ghost"
              size="sm"
              class="cancel-action"
              label={props.cancelLabel}
              onClick={props.onCancel}
            />
            <div class="choices">{actions()}</div>
          </DialogFooter>
        </Dialog>
      }>
      <Drawer
        side={DrawerPosition.BOTTOM}
        open={presented()}
        onOpenChange={handleOpenChange}
        showTrigger={false}
        showClose={false}
        class="paste-media-placement-drawer"
        contentClass="paste-media-placement-drawer-content"
        drawerProps={{
          closeOnOutsidePointer: false,
        }}>
        <div class="paste-media-placement-sheet">
          <div
            class="handle"
            aria-hidden="true"
          />
          <h2 class="title">{props.title}</h2>
          <p class="description">{props.description}</p>
          <div class="choices">{actions()}</div>
          <Button
            variant="ghost"
            size="sm"
            class="cancel-action"
            label={props.cancelLabel}
            onClick={props.onCancel}
          />
        </div>
      </Drawer>
    </Show>
  )
}
