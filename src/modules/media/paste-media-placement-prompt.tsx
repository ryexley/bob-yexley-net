import { Show } from "solid-js"
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

/**
 * Paste-only chooser: put the clipboard files inline in the markdown body, or
 * in the gallery strip. Dismiss / Escape cancels the paste.
 */
export function PasteMediaPlacementPrompt(
  props: PasteMediaPlacementPromptProps,
) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      props.onCancel()
    }
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
    <Show when={props.open}>
      <Show
        when={props.isMobile}
        fallback={
          <Dialog
            open={props.open}
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
          open={props.open}
          onOpenChange={handleOpenChange}
          showTrigger={false}
          class="paste-media-placement-drawer"
          contentClass="paste-media-placement-drawer-content">
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
    </Show>
  )
}
