import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { Button } from "@/components/button"
import { Icon } from "@/components/icon"
import { useNotify } from "@/components/notification"
import { Pin } from "@/modules/auth/components/pin"
import { UserAvatar } from "@/modules/users/components/user-avatar"
import { UserRoleSegmentedControl } from "@/modules/users/components/user-role-segmented-control"
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
  const notify = useNotify()
  const [role, setRole] = createSignal<AdminUserRecord["role"]>("visitor")
  const [status, setStatus] = createSignal<AdminUserRecord["status"]>("pending")
  const [notes, setNotes] = createSignal("")
  const [pin, setPin] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)
  const [isMounted, setIsMounted] = createSignal(false)
  const [mountedUser, setMountedUser] = createSignal<AdminUserRecord | null>(props.user)
  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null)
  let closeUnmountTimeout: ReturnType<typeof setTimeout> | null = null

  const currentUser = createMemo(() => props.user ?? mountedUser())
  const drawerBehavior = createMemo(() => {
    return {
      closeOnEscapeKeyDown: false,
      closeOnOutsidePointer: false,
      closeOnOutsideFocus: false,
      snapPoints: [1],
      breakPoints: [],
      defaultSnapPoint: 1,
    }
  })
  const joinedAt = createMemo(() => {
    const timestamp = currentUser()?.createdAt
    return timestamp ? formatLongDate(timestamp) ?? tr("values.unavailable") : tr("values.unavailable")
  })
  const isDirty = createMemo(() => {
    const user = currentUser()
    if (!user) {
      return false
    }

    return (
      role() !== user.role ||
      status() !== user.status ||
      notes() !== (user.notes ?? "") ||
      pin().length > 0
    )
  })

  const resetForm = () => {
    setRole(currentUser()?.role ?? "visitor")
    setStatus(currentUser()?.status ?? "pending")
    setNotes(currentUser()?.notes ?? "")
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
    const user = props.user
    if (user) {
      setMountedUser(user)
    }
  })

  createEffect(() => {
    currentUser()?.userId
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
      setMountedUser(null)
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

    const user = currentUser()
    if (!user || isSaving() || !isDirty()) {
      return
    }

    setIsSaving(true)
    const result = await updateAdminUserRecord(user.userId, {
      role: role(),
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
    <Show when={isMounted() && currentUser()}>
      <Drawer
        side={DrawerPosition.RIGHT}
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
          <Icon name="chevron_right" />
        </button>
        <div class="user-edit-drawer-shell">
          <div class="user-edit-drawer-summary">
            <UserAvatar
              class="user-edit-drawer-avatar"
              role={role()}
              size="lg"
              variant="surface"
              aria-hidden={true}
            />
            <div class="user-edit-drawer-summary-copy">
              <div class="user-edit-drawer-summary-name">{currentUser()?.displayName}</div>
              <div class="user-edit-drawer-summary-email">
                {currentUser()?.email ?? tr("values.unavailable")}
              </div>
            </div>
          </div>

          <form
            class="user-edit-drawer-form"
            onSubmit={event => void handleSave(event)}>
            <div class="user-edit-drawer-details">
              <p class="user-edit-drawer-detail-line">
                <span class="user-edit-drawer-detail-label">{tr("fields.email")}:</span>{" "}
                {currentUser()?.email ?? tr("values.unavailable")}
              </p>
              <p class="user-edit-drawer-detail-line">
                <span class="user-edit-drawer-detail-label">{tr("fields.joinedAt")}:</span>{" "}
                {joinedAt()}
              </p>
            </div>

            <div class="user-edit-drawer-fieldset">
              <UserRoleSegmentedControl
                value={role()}
                onChange={value => setRole(value as AdminUserRecord["role"])}
                label={tr("fields.role")}
                disabled={isSaving()}
                class="user-edit-drawer-role"
              />
            </div>

            <div class="user-edit-drawer-fieldset">
              <UserStatusSegmentedControl
                value={status()}
                onChange={value => setStatus(value as AdminUserRecord["status"])}
                label={tr("fields.status.label")}
                disabled={isSaving()}
                class="user-edit-drawer-status"
              />
            </div>

            <div class="user-edit-drawer-fieldset">
              <Pin
                label={tr("fields.pin.label")}
                value={pin()}
                onChange={setPin}
                disabled={isSaving()}
                class="user-edit-drawer-pin"
              />
            </div>

            <label class="user-edit-drawer-notes-field">
              <span class="user-edit-drawer-notes-label">{tr("fields.notes.label")}</span>
              <textarea
                class="user-edit-drawer-notes-input"
                value={notes()}
                rows={4}
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
                disabled={isSaving() || !isDirty()}
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
