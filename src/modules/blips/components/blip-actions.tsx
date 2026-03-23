import type { Blip } from "@/modules/blips/data/schema"
import { createMemo, createSignal, splitProps, Show, type JSX } from "solid-js"
import { useConfirm } from "@/components/confirm-dialog"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { Stack } from "@/components/stack"
import { IconButton } from "@/components/icon-button"
import { ptr } from "@/i18n"
import { blipStore } from "@/modules/blips/data"
import { isEmpty } from "@/util"
import "./blip-actions.css"

interface BlipActionsProps {
  blip?: Blip
  onEdit?: (blipId: string) => void
  toolbarExtras?: JSX.Element
}

const tr = ptr("blips.components.blipActions")

export function BlipActions(props: BlipActionsProps) {
  const [local] = splitProps(props, ["blip", "onEdit", "toolbarExtras"])
  const confirm = useConfirm()
  const [isTogglingPublish, setIsTogglingPublish] = createSignal(false)

  const { isAuthenticated, user } = useAuth()
  const supabase = useSupabase()
  const store = blipStore(supabase.client)

  const showToolbar = createMemo(() => {
    if (isEmpty(local.blip)) {
      return false
    }

    if (!isAuthenticated()) {
      return false
    }

    // Drafts created locally can briefly exist without user_id in cache.
    // Allow toolbar in that case for authenticated users.
    if (!local.blip?.published && !local.blip?.user_id) {
      return true
    }

    if (user()?.id !== local.blip?.user_id) {
      return false
    }

    return true
  })

  const handleTogglePublish = async () => {
    const blipId = local.blip?.id
    if (!blipId || isTogglingPublish()) {
      return
    }

    setIsTogglingPublish(true)

    try {
      if (local.blip?.published) {
        await store.unpublish(blipId)
      } else {
        await store.publish(blipId)
      }
    } catch (error) {
      console.error("Error toggling publish state:", error)
    } finally {
      setIsTogglingPublish(false)
    }
  }

  return (
    <>
      <Show when={showToolbar()}>
        <Stack
          orient="row"
          align="center"
          justify="end"
          fullWidth
          class="blip-actions"
          gap="0.25rem"
          role="toolbar"
          aria-label={tr("toolbarAriaLabel")}>
          <Show when={local.toolbarExtras}>
            {local.toolbarExtras}
            <span
              class="toolbar-separator"
              aria-hidden="true"
            />
          </Show>
          <IconButton
            size="xs"
            icon="delete"
            class="delete"
            onClick={() => {
              const blipId = local.blip?.id
              if (!blipId) {
                return
              }

              confirm({
                title: tr("confirmDelete.title"),
                prompt: tr("confirmDelete.prompt"),
                variant: "destructive",
                confirmationActionLabel: tr("confirmDelete.actions.confirm"),
                confirmationActionLoadingLabel: tr(
                  "confirmDelete.actions.confirming",
                ),
                cancelActionLabel: tr("confirmDelete.actions.cancel"),
                onConfirm: async () => {
                  await store.remove(blipId)
                },
              })
            }}
          />
          <Show when={!local.blip?.published}>
            <IconButton
              size="xs"
              icon="rocket_launch"
              class="publish"
              onClick={handleTogglePublish}
              disabled={isTogglingPublish()}
            />
          </Show>
          <Show when={local.blip?.published}>
            <IconButton
              size="xs"
              icon="check_circle"
              class="unpublish"
              onClick={handleTogglePublish}
              disabled={isTogglingPublish()}
            />
          </Show>
          <IconButton
            size="xs"
            icon="edit_note"
            class="edit"
            onClick={() => {
              const blipId = local.blip?.id
              if (!blipId) {
                return
              }

              local.onEdit?.(blipId)
            }}
          />
        </Stack>
      </Show>
    </>
  )
}
