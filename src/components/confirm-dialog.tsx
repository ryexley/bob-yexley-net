import { createSignal, Show, type ParentProps } from "solid-js"
import { Button } from "@/components/button"
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "@/components/dialog"
import { ptr } from "@/i18n"
import { cx, isNotEmpty } from "@/util"
import "./confirm-dialog.css"

type ConfirmVariant = "default" | "destructive"

type ConfirmationContext = {
  title?: string
  prompt?: string
  variant?: ConfirmVariant
  confirmationActionLabel?: string
  confirmationActionLoadingLabel?: string
  cancelActionLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

const [confirmationContext, setConfirmationContext] =
  createSignal<ConfirmationContext | null>(null)
const tr = ptr("shared.components.confirmDialog")

export function ConfirmationProvider(props: ParentProps) {
  const [isConfirming, setIsConfirming] = createSignal(false)

  const closeDialog = () => {
    if (isConfirming()) {
      return
    }

    const context = confirmationContext()
    context?.onCancel?.()
    setConfirmationContext(null)
  }

  return (
    <>
      {props.children}
      <Show when={confirmationContext()}>
        {ctx => {
          const handleConfirm = async () => {
            if (isConfirming()) {
              return
            }

            setIsConfirming(true)

            try {
              await ctx().onConfirm()
              setConfirmationContext(null)
            } catch (error) {
              console.error("Confirmation action failed", error)
            } finally {
              setIsConfirming(false)
            }
          }

          return (
            <Dialog
              open={!!ctx()}
              class={cx(
                "confirmation-dialog-content",
                (ctx().variant || "default") === "destructive" && "destructive",
              )}
              overlayClass="confirmation-dialog-overlay"
              onOpenChange={open => {
                if (!open && !isConfirming()) {
                  closeDialog()
                }
              }}>
              {isNotEmpty(ctx().title) ? (
                <DialogTitle class="confirmation-title">{ctx().title}</DialogTitle>
              ) : null}
              {isNotEmpty(ctx().prompt) ? (
                <DialogDescription class="confirmation-description">
                  {ctx().prompt}
                </DialogDescription>
              ) : null}
              <DialogFooter class="confirmation-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  class="confirmation-action-cancel"
                  onClick={closeDialog}
                  disabled={isConfirming()}
                  label={ctx().cancelActionLabel || tr("actions.cancel")}
                />
                <Button
                  variant="primary"
                  size="sm"
                  label={
                    isConfirming()
                      ? ctx().confirmationActionLoadingLabel || tr("actions.confirming")
                      : ctx().confirmationActionLabel || tr("actions.confirm")
                  }
                  class={`confirmation-action-confirm${
                    (ctx().variant || "default") === "destructive"
                      ? " destructive"
                      : ""
                  }`}
                  disabled={isConfirming()}
                  onClick={handleConfirm}
                />
              </DialogFooter>
            </Dialog>
          )
        }}
      </Show>
    </>
  )
}

export const useConfirm = () => {
  return (options: Omit<ConfirmationContext, "onCancel">) => {
    setConfirmationContext({
      ...options,
      variant: options?.variant || "default",
      onCancel: () => setConfirmationContext(null),
    })
  }
}
