import { createMemo, createSignal, Show } from "solid-js"
import { BlipEditor } from "~/modules/blips/components/blip-editor"
import { useAuth } from "@/context/auth-context"
import { Blip as BlipIcon } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { Menu } from "@/components/menu"
import { Stack } from "@/components/stack"
import { ptr } from "@/i18n"
import { isNotEmpty } from "@/util"
import "./user-menu.css"

const tr = ptr("home.components.userMenu")

export function UserMenu() {
  const { isAuthenticated, user, logout } = useAuth() as any
  const [showNewBlipDrawer, setShowNewBlipDrawer] = createSignal(false)

  const MenuHeader = createMemo(() => {
    return isNotEmpty(user()) ? (
      <Stack
        gap="0"
        fullWidth
        class="user-menu-header">
        <div class="label">{tr("header.label")}</div>
        <div class="email">{user().email}</div>
        <IconButton
          icon="logout"
          size="sm"
          onClick={logout}
          class="user-logout-button"
        />
      </Stack>
    ) : null
  })

  return (
    <Show when={isAuthenticated()}>
      <Menu
        triggerIcon="account_circle"
        triggerButtonSize="sm"
        triggerClass="user-menu"
        dropdownMenuProps={{ modal: false }}
        items={[
          {
            iconNode: (
              <BlipIcon
                size="1rem"
                class="menu-blip-icon"
                blipColor="var(--menu-blip-accent)"
              />
            ),
            label: tr("blip"),
            onClick: () => setShowNewBlipDrawer(true),
          },
          /* {
            icon: "logout",
            label: tr("logout"),
            onClick: logout,
          }, */
        ]}
        Header={MenuHeader}
      />
      <BlipEditor
        open={showNewBlipDrawer()}
        onPanelOpenChange={open => setShowNewBlipDrawer(open)}
        close={() => setShowNewBlipDrawer(false)}
      />
    </Show>
  )
}
