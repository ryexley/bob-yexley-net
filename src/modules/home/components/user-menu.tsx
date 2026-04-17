import {
  JSX,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Drawer } from "@/components/drawer"
import { useAuth } from "@/context/auth-context"
import { useViewport } from "@/context/viewport"
import { Blip as BlipIcon, Icon } from "@/components/icon"
import { Menu } from "@/components/menu"
import { Stack } from "@/components/stack"
import { UserAvatar } from "@/modules/users/components/user-avatar"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { withWindow } from "@/util/browser"
import { generateRandomRadialGradients } from "@/util/image"
import { isNotEmpty } from "@/util"
import { ProfileDrawer } from "@/modules/home/components/profile-drawer"
import { clearActiveTextInputSession } from "@/modules/blips/components/editor-focus-bridge"
import { useOptionalBlipComposer } from "@/modules/blips/context/blip-composer-context"
import "./user-menu.css"

const tr = ptr("home.components.userMenu")
const MOBILE_MENU_MAX_WIDTH = 768
type UserMenuItem = {
  icon?: string
  iconNode?: JSX.Element
  label: string
  onClick: () => void | Promise<void>
}

export function UserMenu() {
  const navigate = useNavigate()
  const { isAdmin, isAuthenticated, isSuperuser, user, userProfile, logout } =
    useAuth() as any
  const viewport = useViewport()
  const composer = useOptionalBlipComposer()
  const [showProfileDrawer, setShowProfileDrawer] = createSignal(false)
  const [showMobileMenuDrawer, setShowMobileMenuDrawer] = createSignal(false)
  const [hasMounted, setHasMounted] = createSignal(false)
  const [mobileMenuContentElement, setMobileMenuContentElement] =
    createSignal<HTMLElement | null>(null)
  let mobileMenuTextInputCleanupHandle:
    | ReturnType<typeof clearActiveTextInputSession>
    | null = null
  const useDrawerMenu = createMemo(
    () => hasMounted() && viewport.width() <= MOBILE_MENU_MAX_WIDTH,
  )
  const mobileMenuBackground = createMemo(() => ({
    "background-image": generateRandomRadialGradients(),
  }))

  onMount(() => {
    setHasMounted(true)
  })

  const cancelMobileMenuTextInputCleanup = () => {
    if (mobileMenuTextInputCleanupHandle) {
      mobileMenuTextInputCleanupHandle.cancel()
      mobileMenuTextInputCleanupHandle = null
    }
  }

  onCleanup(() => {
    cancelMobileMenuTextInputCleanup()
  })

  createEffect(() => {
    if (!showMobileMenuDrawer()) {
      return
    }

    const content = mobileMenuContentElement()
    if (!content) {
      return
    }

    withWindow(window => {
      let blurTimeout: ReturnType<typeof setTimeout> | null = null

      const blurFocusedDrawerElement = () => {
        const activeElement = window.document.activeElement
        if (activeElement instanceof HTMLElement && content.contains(activeElement)) {
          activeElement.blur()
        }
      }

      const animationFrameId = window.requestAnimationFrame(() => {
        blurFocusedDrawerElement()
        blurTimeout = window.setTimeout(blurFocusedDrawerElement, 120)
      })

      onCleanup(() => {
        window.cancelAnimationFrame(animationFrameId)
        if (blurTimeout) {
          clearTimeout(blurTimeout)
        }
      })
    })
  })

  const closeMobileMenu = () => {
    cancelMobileMenuTextInputCleanup()
    setShowMobileMenuDrawer(false)
  }

  const openProfileDrawer = () => {
    closeMobileMenu()
    setShowProfileDrawer(true)
  }

  const openBlipEditor = () => {
    closeMobileMenu()
    composer?.openNewRoot()
  }

  const handleLogout = async () => {
    closeMobileMenu()
    await logout()
  }

  const openAdminHome = () => {
    closeMobileMenu()
    navigate(pages.admin)
  }

  const renderMenuHeader = () => {
    return isNotEmpty(user()) ? (
      <Stack
        gap="0"
        fullWidth
        class="user-menu-header">
        <div class="label">{tr("header.label")}</div>
        <div class="name">{userProfile()?.displayName ?? user().email}</div>
        <div class="email">{user().email}</div>
      </Stack>
    ) : null
  }
  const renderUserMenuTrigger = () => (
    <UserAvatar
      class="user-menu-trigger-content"
      role={isSuperuser() ? "superuser" : null}
      displayName={userProfile()?.displayName ?? user()?.email ?? null}
      avatarSeed={userProfile()?.avatarSeed ?? null}
      avatarVersion={userProfile()?.avatarVersion ?? null}
      size="md"
      variant="surface"
      aria-hidden={true}
    />
  )

  const menuItems = createMemo(() => {
    const items: UserMenuItem[] = [
      {
        icon: "account_circle",
        label: tr("profile"),
        onClick: openProfileDrawer,
      },
    ]

    if (isSuperuser()) {
      items.push({
        icon: "shield_person",
        label: tr("admin"),
        onClick: openAdminHome,
      })
    }

    if (isAdmin()) {
      items.push({
        iconNode: (
          <BlipIcon
            size="1.125rem"
            class="menu-blip-icon"
            blipColor="var(--menu-blip-accent)"
          />
        ),
        label: tr("blip"),
        onClick: openBlipEditor,
      })
    }

    items.push({
      icon: "logout",
      label: tr("logout"),
      onClick: () => {
        void handleLogout()
      },
    })

    return items
  })

  return (
    <Show when={hasMounted() && isAuthenticated()}>
      <>
        <Show
          when={useDrawerMenu()}
          fallback={
            <Menu
              Trigger={renderUserMenuTrigger()}
              triggerButtonSize="sm"
              triggerClass="user-menu"
              dropdownMenuProps={{ modal: false }}
              items={menuItems()}
              Header={renderMenuHeader()}
            />
          }>
          <button
            type="button"
            class="user-menu"
            aria-label="User menu"
            onClick={() => {
              cancelMobileMenuTextInputCleanup()
              mobileMenuTextInputCleanupHandle = clearActiveTextInputSession(
                "userMenu.mobileDrawer.beforeOpen",
              )
              setShowMobileMenuDrawer(true)
            }}>
            {renderUserMenuTrigger()}
          </button>
          <Drawer
            side="bottom"
            open={showMobileMenuDrawer()}
            onOpenChange={open => {
              if (!open) {
                cancelMobileMenuTextInputCleanup()
              }
              setShowMobileMenuDrawer(open)
            }}
            class="user-menu-drawer"
            showTrigger={false}
            contentRef={setMobileMenuContentElement}
            contentProps={{
              onOpenAutoFocus: event => event.preventDefault(),
            }}
            showClose={false}>
            <Stack
              class="user-menu-drawer-shell"
              style={mobileMenuBackground()}
              gap="0.75rem">
              <div class="handle" />
              <div class="user-menu-drawer-summary">{renderMenuHeader()}</div>
              <Stack
                class="user-menu-drawer-items"
                gap="0.5rem">
                <For each={menuItems()}>
                  {item => (
                    <button
                      type="button"
                      class="user-menu-drawer-item"
                      onClick={() => {
                        void item.onClick()
                      }}>
                      {item.iconNode || (item.icon ? <Icon name={item.icon} /> : null)}
                      <span>{item.label}</span>
                    </button>
                  )}
                </For>
              </Stack>
            </Stack>
          </Drawer>
        </Show>
        <ProfileDrawer
          open={showProfileDrawer()}
          onOpenChange={open => setShowProfileDrawer(open)}
        />
      </>
    </Show>
  )
}
