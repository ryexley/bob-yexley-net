import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { Button } from "@/components/button"
import { Icon } from "@/components/icon"
import { useNotify } from "@/components/notification"
import { useViewport } from "@/context/viewport"
import { Pin } from "@/modules/auth/components/pin"
import { updateAdminUserRecord } from "@/modules/users/data/client"
import type { AdminUserRecord } from "@/modules/users/data/types"
import { UserStatusSegmentedControl } from "@/modules/users/components/user-status-segmented-control"
import { ptr } from "@/i18n"
import { withWindow } from "@/util/browser"
import { formatLongDate } from "@/util/formatters"
import "./user-edit-drawer.css"

const tr = ptr("users.components.userEditDrawer")

type UserEditDrawerProps = {
  open: boolean
  user: AdminUserRecord | null
  onOpenChange: (open: boolean) => void
  onSaved: (user: AdminUserRecord, pinWasReset: boolean) => void
}

export function UserEditDrawer(props: UserEditDrawerProps) {
  const CLOSE_ANIMATION_MS = 500
  const viewport = useViewport()
  const notify = useNotify()
  const [status, setStatus] = createSignal<AdminUserRecord["status"]>("pending")
  const [notes, setNotes] = createSignal("")
  const [pin, setPin] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)
  const [isMounted, setIsMounted] = createSignal(false)
  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null)
  let closeUnmountTimeout: ReturnType<typeof setTimeout> | null = null

  const drawerSide = createMemo(() =>
    viewport.width() <= 640 ? DrawerPosition.BOTTOM : DrawerPosition.RIGHT,
  )
  const drawerBehavior = createMemo(() => {
    const isDesktopSideDrawer = drawerSide() === DrawerPosition.RIGHT

    return {
      closeOnEscapeKeyDown: false,
      closeOnOutsidePointer: false,
      closeOnOutsideFocus: false,
      snapPoints: isDesktopSideDrawer ? [1] : [0, 1],
      breakPoints: isDesktopSideDrawer ? [] : [null],
      defaultSnapPoint: 1,
    }
  })
  const joinedAt = createMemo(() => {
    const timestamp = props.user?.createdAt
    return timestamp ? formatLongDate(timestamp) ?? tr("values.unavailable") : tr("values.unavailable")
  })
  const statusHint = createMemo(() =>
    pin().length > 0 ? tr("fields.status.pinResetHint") : tr("fields.status.hint"),
  )
  const pinHint = createMemo(() =>
    pin().length > 0 ? tr("fields.pin.activeHint") : tr("fields.pin.hint"),
  )

  const resetForm = () => {
    setStatus(props.user?.status ?? "pending")
    setNotes(props.user?.notes ?? "")
    setPin("")
  }

  const requestClose = () => {
    if (isSaving()) {
      return
    }

    props.onOpenChange(false)
  }

  const clearCloseUnmountTimeout = () => {
    if (closeUnmountTimeout) {
      clearTimeout(closeUnmountTimeout)
      closeUnmountTimeout = null
    }
  }

  createEffect(() => {
    props.user?.userId
    if (props.open) {
      resetForm()
    }
  })

  createEffect(() => {
    if (!props.open) {
      resetForm()
    }
  })

  createEffect(() => {
    if (props.open) {
      clearCloseUnmountTimeout()
      setIsMounted(true)
      return
    }

    if (!isMounted()) {
      return
    }

    clearCloseUnmountTimeout()
    closeUnmountTimeout = setTimeout(() => {
      setIsMounted(false)
      closeUnmountTimeout = null
    }, CLOSE_ANIMATION_MS)
  })

  createEffect(() => {
    if (!props.open || isSaving()) {
      return
    }

    const content = contentElement()
    if (!content) {
      return
    }

    withWindow(window => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return
        }

        event.preventDefault()
        requestClose()
      }

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target
        if (!(target instanceof Node) || content.contains(target)) {
          return
        }

        requestClose()
      }

      window.document.addEventListener("keydown", handleKeyDown)
      window.document.addEventListener("pointerdown", handlePointerDown, true)

      onCleanup(() => {
        window.document.removeEventListener("keydown", handleKeyDown)
        window.document.removeEventListener("pointerdown", handlePointerDown, true)
      })
    })
  })

  onCleanup(() => {
    clearCloseUnmountTimeout()
  })

  const handleSave = async (event: Event) => {
    event.preventDefault()

    if (!props.user || isSaving()) {
      return
    }

    setIsSaving(true)
    const result = await updateAdminUserRecord(props.user.userId, {
      status: status(),
      notes: notes(),
      pin: pin(),
    })
    setIsSaving(false)

    if (!result.success || !result.data) {
      notify.error({
        title: tr("notifications.saveError"),
        content: result.error ?? tr("notifications.saveError"),
      })
      return
    }

    props.onSaved(result.data, result.pinWasReset)
    props.onOpenChange(false)
    notify.success({
      content: result.pinWasReset
        ? tr("notifications.saveSuccessWithPinReset")
        : tr("notifications.saveSuccess"),
    })
  }

  return (
    <Show when={isMounted() && props.user}>
      <Drawer
        side={drawerSide()}
        open={props.open}
        onOpenChange={open => props.onOpenChange(open)}
        contentRef={setContentElement}
        showTrigger={false}
        showClose={false}
        drawerProps={drawerBehavior()}
        class="user-edit-drawer"
        title={tr("title")}
        closeAriaLabel={tr("actions.close")}>
        <button
          type="button"
          class="user-edit-drawer-close"
          aria-label={tr("actions.close")}
          onClick={() => requestClose()}>
          <Icon name="close" />
        </button>
        <div class="user-edit-drawer-shell">
          <div class="user-edit-drawer-summary">
            <div
              class="user-edit-drawer-avatar"
              aria-hidden="true">
              <Icon name="account_circle" />
            </div>
            <div class="user-edit-drawer-summary-copy">
              <div class="user-edit-drawer-summary-name">{props.user?.displayName}</div>
              <div class="user-edit-drawer-summary-email">
                {props.user?.email ?? tr("values.unavailable")}
              </div>
            </div>
          </div>

          <form
            class="user-edit-drawer-form"
            onSubmit={event => void handleSave(event)}>
            <div class="user-edit-drawer-details">
              <p class="user-edit-drawer-detail-line">
                <span class="user-edit-drawer-detail-label">{tr("fields.email")}:</span>{" "}
                {props.user?.email ?? tr("values.unavailable")}
              </p>
              <p class="user-edit-drawer-detail-line">
                <span class="user-edit-drawer-detail-label">{tr("fields.joinedAt")}:</span>{" "}
                {joinedAt()}
              </p>
            </div>

            <div class="user-edit-drawer-fieldset">
              <UserStatusSegmentedControl
                value={status()}
                onChange={value => setStatus(value as AdminUserRecord["status"])}
                label={tr("fields.status.label")}
                disabled={isSaving()}
              />
              <p class="user-edit-drawer-field-hint">{statusHint()}</p>
            </div>

            <div class="user-edit-drawer-fieldset">
              <Pin
                label={tr("fields.pin.label")}
                value={pin()}
                onChange={setPin}
                disabled={isSaving()}
              />
              <p class="user-edit-drawer-field-hint">{pinHint()}</p>
            </div>

            <label class="user-edit-drawer-notes-field">
              <span class="user-edit-drawer-notes-label">{tr("fields.notes.label")}</span>
              <textarea
                class="user-edit-drawer-notes-input"
                value={notes()}
                rows={6}
                disabled={isSaving()}
                placeholder={tr("fields.notes.placeholder")}
                onInput={event => setNotes(event.currentTarget.value)}
              />
              <span class="user-edit-drawer-field-hint">{tr("fields.notes.hint")}</span>
            </label>

            <div class="user-edit-drawer-actions">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                label={isSaving() ? tr("actions.saving") : tr("actions.save")}
                disabled={isSaving()}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                label={tr("actions.cancel")}
                onClick={() => requestClose()}
                disabled={isSaving()}
              />
            </div>
          </form>
        </div>
      </Drawer>
    </Show>
  )
}
