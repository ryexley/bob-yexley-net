import { createMemo, Show } from "solid-js"
import { useAuth } from "@/context/auth-context"
import { Menu } from "@/components/menu"
import { Stack } from "@/components/stack"
import { ptr } from "@/i18n"
import { isNotEmpty } from "@/util"
import "./user-menu.css"

const tr = ptr("home.components.userMenu")

export function UserMenu() {
  const { isAuthenticated, user, logout } = useAuth() as any

  const MenuHeader = createMemo(() => {
    return isNotEmpty(user()) ? (
      <Stack
        gap="0"
        fullWidth
        class="user-menu-header [&>*]:w-full">
        <div class="label">{tr("header.label")}</div>
        <div class="email">{user().email}</div>
      </Stack>
    ) : null
  })

  return (
    <Show when={isAuthenticated()}>
      <Menu
        triggerIcon="account_circle"
        triggerButtonSize="sm"
        triggerClass="user-menu"
        items={[
          {
            icon: "comic_bubble",
            label: tr("blip"),
            onClick: () => console.log("blip"),
          },
          {
            icon: "logout",
            label: tr("logout"),
            onClick: logout,
          },
        ]}
        Header={MenuHeader}
      />
    </Show>
  )
}
