import { createMemo, Show } from "solid-js"
import { useLocation } from "@solidjs/router"
import { SharedHeadContent } from "@/layouts/shared"
import { MainHeader } from "@/modules/home/components/main-header"
import { UserMenu } from "@/modules/home/components/user-menu"
import { pages } from "@/urls"
import "@/layouts/main/main.css"

export function MainLayout(props) {
  const location = useLocation()
  const showMainChrome = createMemo(() => location.pathname !== pages.login)

  return (
    <>
      <SharedHeadContent />
      <Show when={showMainChrome()}>
        <MainHeader />
      </Show>
      {props.children}
      <Show when={showMainChrome()}>
        <UserMenu />
      </Show>
    </>
  )
}
