import { createEffect, createMemo, createSignal } from "solid-js"
import { Button } from "@/components/button"
import { FormDrawer } from "@/components/form-drawer"
import { InfoTooltip } from "@/components/info-tooltip"
import { useNotify } from "@/components/notification"
import { Switch } from "@/components/switch"
import { Pin } from "@/modules/auth/components/pin"
import { UserAvatar } from "@/modules/users/components/user-avatar"
import { UserRoleSegmentedControl } from "@/modules/users/components/user-role-segmented-control"
import { updateAdminUserRecord } from "@/modules/users/data/client"
import type { AdminUserRecord } from "@/modules/users/data/types"
import { UserStatusSegmentedControl } from "@/modules/users/components/user-status-segmented-control"
import { ptr } from "@/i18n"
import { formatLongDate } from "@/util/formatters"
import "./user-edit-drawer.css"

const tr = ptr("users.components.userEditDrawer")

type UserEditDrawerProps = {
  open: boolean
  user: AdminUserRecord | null
  onOpenChange: (open: boolean) => void
  onSaved: (user: AdminUserRecord, pinWasReset: boolean) => void
}

const USER_EDIT_FORM_ID = "user-edit-drawer-form"

export function UserEditDrawer(props: UserEditDrawerProps) {
  const notify = useNotify()
  const [role, setRole] = createSignal<AdminUserRecord["role"]>("visitor")
  const [status, setStatus] = createSignal<AdminUserRecord["status"]>("pending")
  const [trusted, setTrusted] = createSignal(false)
  const [notes, setNotes] = createSignal("")
  const [pin, setPin] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)
  const [mountedUser, setMountedUser] = createSignal<AdminUserRecord | null>(props.user)

  const currentUser = createMemo(() => props.user ?? mountedUser())
  const joinedAt = createMemo(() => {
    const timestamp = currentUser()?.createdAt
    return timestamp ? formatLongDate(timestamp) ?? tr("values.unavailable") : tr("values.unavailable")
  })
  const isTrustedManagedByRole = createMemo(() => {
    const currentRole = role()
    return currentRole === "admin" || currentRole === "superuser"
  })
  const isDirty = createMemo(() => {
    const user = currentUser()
    if (!user) {
      return false
    }

    return (
      role() !== user.role ||
      status() !== user.status ||
      trusted() !== user.trusted ||
      notes() !== (user.notes ?? "") ||
      pin().length > 0
    )
  })

  const resetForm = () => {
    setRole(currentUser()?.role ?? "visitor")
    setStatus(currentUser()?.status ?? "pending")
    setTrusted(currentUser()?.trusted ?? false)
    setNotes(currentUser()?.notes ?? "")
    setPin("")
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
      trusted: trusted(),
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
    <FormDrawer
      open={props.open}
      onOpenChange={open => props.onOpenChange(open)}
      title={tr("title")}
      closeAriaLabel={tr("actions.close")}
      class="user-edit-drawer"
      when={Boolean(currentUser())}
      canDismiss={() => !isSaving()}
      onClosed={() => setMountedUser(null)}
      actionsClass="form-drawer-actions user-edit-drawer-actions"
      actions={
        <>
          <Button
            type="submit"
            form={USER_EDIT_FORM_ID}
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
            onClick={() => props.onOpenChange(false)}
            disabled={isSaving()}
          />
        </>
      }>
      <div class="user-edit-drawer-summary">
        <UserAvatar
          class="user-edit-drawer-avatar"
          role={role()}
          displayName={currentUser()?.displayName ?? currentUser()?.email ?? null}
          avatarSeed={currentUser()?.avatarSeed ?? null}
          avatarVersion={currentUser()?.avatarVersion ?? null}
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
        id={USER_EDIT_FORM_ID}
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

        <Switch
          checked={trusted() || isTrustedManagedByRole()}
          disabled={isSaving() || isTrustedManagedByRole()}
          onChange={setTrusted}
          label={tr("fields.trusted.label")}
          containerClass="user-edit-drawer-trusted"
          endContent={
            <InfoTooltip
              info={tr("fields.trusted.tooltip")}
              contentClass="user-edit-drawer-trusted-tooltip"
              aria-label={tr("fields.trusted.tooltipAriaLabel")}
            />
          }
        />

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
      </form>
    </FormDrawer>
  )
}
