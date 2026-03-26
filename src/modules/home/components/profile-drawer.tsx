import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { Button } from "@/components/button"
import { Icon } from "@/components/icon"
import { Input } from "@/components/input"
import { useNotify } from "@/components/notification"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { useViewport } from "@/context/viewport"
import { ptr } from "@/i18n"
import { withWindow } from "@/util/browser"
import { formatLongDate } from "@/util/formatters"
import "./profile-drawer.css"

const tr = ptr("home.components.userMenu.profileDrawer")
const trMenu = ptr("home.components.userMenu")

type ProfileDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const roleStatusKey = {
  visitor: "visitor",
  admin: "admin",
  superuser: "superuser",
} as const

export function ProfileDrawer(props: ProfileDrawerProps) {
  const CLOSE_ANIMATION_MS = 500
  const auth = useAuth()
  const supabase = useSupabase()
  const viewport = useViewport()
  const notify = useNotify()
  const [isEditing, setIsEditing] = createSignal(false)
  const [draftDisplayName, setDraftDisplayName] = createSignal("")
  const [isSaving, setIsSaving] = createSignal(false)
  const [isLoggingOut, setIsLoggingOut] = createSignal(false)
  const [isMounted, setIsMounted] = createSignal(props.open)
  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null)
  let closeUnmountTimeout: ReturnType<typeof setTimeout> | null = null

  const displayName = createMemo(
    () => auth.visitor()?.displayName ?? auth.user()?.email ?? tr("values.unavailable"),
  )

  const resolvedStatus = createMemo(() => {
    const visitorStatus = auth.visitor()?.status
    if (visitorStatus) {
      return tr(`status.${visitorStatus}`)
    }

    const role = auth.role()
    if (role) {
      return tr(`status.${roleStatusKey[role]}`)
    }

    return tr("values.unavailable")
  })

  const joinedAt = createMemo(() => {
    const timestamp = auth.visitor()?.createdAt ?? auth.profile()?.roleCreatedAt ?? null
    if (!timestamp) {
      return tr("values.unavailable")
    }

    return formatLongDate(timestamp) ?? tr("values.unavailable")
  })

  const canEditName = createMemo(() => Boolean(auth.visitor()?.id))
  const resolvedRole = createMemo(() => {
    const role = auth.role()
    if (!role) {
      return tr("values.unavailable")
    }

    return tr(`status.${roleStatusKey[role]}`)
  })
  const showPrivilegedBadge = createMemo(() => {
    const role = auth.role()
    return role === "admin" || role === "superuser"
  })
  const drawerSide = createMemo(() =>
    viewport.width() <= 640 ? DrawerPosition.BOTTOM : DrawerPosition.RIGHT,
  )
  const canDismissImplicitly = createMemo(() => !isEditing())
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

  const resetEditingState = () => {
    setIsEditing(false)
    setDraftDisplayName(auth.visitor()?.displayName ?? "")
  }

  const requestClose = () => {
    props.onOpenChange(false)
  }

  const clearCloseUnmountTimeout = () => {
    if (closeUnmountTimeout) {
      clearTimeout(closeUnmountTimeout)
      closeUnmountTimeout = null
    }
  }

  createEffect(() => {
    auth.visitor()?.displayName
    if (!isEditing()) {
      setDraftDisplayName(auth.visitor()?.displayName ?? "")
    }
  })

  createEffect(() => {
    if (!props.open) {
      resetEditingState()
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
    if (!props.open || !canDismissImplicitly()) {
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
    if (!canEditName() || isSaving()) {
      return
    }

    setIsSaving(true)
    const { data, error } = await supabase.updateCurrentVisitorDisplayName(
      draftDisplayName(),
    )
    setIsSaving(false)

    if (error || !data) {
      notify.error({
        title: tr("notifications.saveError"),
        content: error ?? tr("notifications.saveError"),
      })
      return
    }

    auth.replaceProfile(data)
    setIsEditing(false)
    notify.success({
      content: tr("notifications.saveSuccess"),
    })
  }

  const handleLogout = async () => {
    if (isLoggingOut()) {
      return
    }

    setIsLoggingOut(true)
    await auth.logout()
    setIsLoggingOut(false)
    props.onOpenChange(false)
  }

  return (
    <Show when={isMounted()}>
      <Drawer
        side={drawerSide()}
        open={props.open}
        onOpenChange={open => props.onOpenChange(open)}
        contentRef={setContentElement}
        showTrigger={false}
        showClose={false}
        drawerProps={drawerBehavior()}
        class="profile-drawer"
        title={tr("title")}
        closeAriaLabel={tr("actions.close")}>
        <button
          type="button"
          class="profile-drawer-close"
          aria-label={tr("actions.close")}
          onClick={() => requestClose()}>
          <Icon name="close" />
        </button>
        <div class="profile-drawer-shell">
          <div class="profile-drawer-summary">
            <div class="profile-drawer-avatar" aria-hidden="true">
              <Icon name="account_circle" />
              <Show when={showPrivilegedBadge()}>
                <span class="profile-drawer-avatar-badge" aria-hidden="true">
                  <Icon name="shield_person" />
                </span>
              </Show>
            </div>
            <div class="profile-drawer-summary-copy">
              <div class="profile-drawer-summary-name">{displayName()}</div>
              <div class="profile-drawer-summary-email">
                {auth.user()?.email ?? tr("values.unavailable")}
              </div>
            </div>
            {canEditName() ? (
              <Button
                variant="outline"
                size="sm"
                icon={isEditing() ? "close" : "person_edit"}
                label={isEditing() ? tr("actions.cancelEdit") : tr("actions.edit")}
                class="profile-drawer-edit-toggle"
                onClick={() => {
                  if (isEditing()) {
                    resetEditingState()
                    return
                  }

                  setDraftDisplayName(auth.visitor()?.displayName ?? "")
                  setIsEditing(true)
                }}
              />
            ) : null}
          </div>

          <form class="profile-drawer-form" onSubmit={handleSave}>
            <Show
              when={isEditing() && canEditName()}
              fallback={
                <div class="profile-drawer-details">
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.email")}:
                    </span>{" "}
                    {auth.user()?.email ?? tr("values.unavailable")}
                  </p>
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.role")}:
                    </span>{" "}
                    {resolvedRole()}
                  </p>
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.status")}:
                    </span>{" "}
                    {resolvedStatus()}
                  </p>
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.joinedAt")}:
                    </span>{" "}
                    {joinedAt()}
                  </p>
                </div>
              }>
              <div class="profile-drawer-edit-fields">
                <Input
                  label={tr("fields.name")}
                  value={draftDisplayName()}
                  onInput={event => setDraftDisplayName(event.currentTarget.value)}
                />
                <div class="profile-drawer-details">
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.email")}:
                    </span>{" "}
                    {auth.user()?.email ?? tr("values.unavailable")}
                  </p>
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.role")}:
                    </span>{" "}
                    {resolvedRole()}
                  </p>
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.status")}:
                    </span>{" "}
                    {resolvedStatus()}
                  </p>
                  <p class="profile-drawer-detail-line">
                    <span class="profile-drawer-detail-label">
                      {tr("fields.joinedAt")}:
                    </span>{" "}
                    {joinedAt()}
                  </p>
                </div>
              </div>
            </Show>

            <div class="profile-drawer-actions">
              {isEditing() && canEditName() ? (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  label={isSaving() ? tr("actions.saving") : tr("actions.save")}
                  disabled={isSaving()}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon="logout"
                label={auth.isAuthenticated() ? trMenu("logout") : ""}
                class="profile-drawer-logout"
                onClick={() => {
                  void handleLogout()
                }}
                disabled={isLoggingOut()}
              />
            </div>
          </form>
        </div>
      </Drawer>
    </Show>
  )
}
