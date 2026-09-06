import { A, useLocation, useNavigate } from "@solidjs/router"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Drawer } from "@/components/drawer"
import { Blip as BlipIcon, Icon } from "@/components/icon"
import { Stack } from "@/components/stack"
import { useAuth } from "@/context/auth-context"
import { useVisitorAuth } from "@/modules/auth/components/visitor-auth-modal"
import { useOptionalBlipComposer } from "@/modules/blips/context/blip-composer-context"
import { UserMenu } from "@/modules/home/components/user-menu"
import "@/modules/home/components/user-menu.css"
import {
  assignPath,
  getMainNavLinks,
  scrollToHomeSectionIfPresent,
} from "@/modules/home/components/main-nav"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { generateRandomRadialGradients } from "@/util/image"
import { clsx as cx } from "@/util"
import "./site-dock.css"

const tr = ptr("home.components.siteDock")

const navIconByPath: Record<string, string> = {
  [pages.home]: "home",
  [pages.resume]: "description",
}

export function SiteDock() {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const visitorAuth = useVisitorAuth()
  const composer = useOptionalBlipComposer()
  const [menuOpen, setMenuOpen] = createSignal(false)
  const navLinks = createMemo(() => getMainNavLinks(location.pathname))
  const menuBackground = createMemo(() => ({
    "background-image": generateRandomRadialGradients(),
  }))
  const homeCurrent = (): "page" | undefined =>
    location.pathname === pages.home ? "page" : undefined
  const blipsCurrent = (): "page" | undefined =>
    location.pathname === pages.blips || location.pathname.startsWith(`${pages.blips}/`)
      ? "page"
      : undefined
  const composerOpen = () => Boolean(composer?.activeKind())

  const handleHomeClick = (event: MouseEvent) => {
    if (scrollToHomeSectionIfPresent(pages.home)) {
      event.preventDefault()
    }
  }

  const handleDrawerLinkClick = (link: ReturnType<typeof navLinks>[number]) => {
    setMenuOpen(false)

    if (link.isStatic) {
      assignPath(link.path)
      return
    }

    if (scrollToHomeSectionIfPresent(link.path)) {
      return
    }

    navigate(link.path)
  }

  return (
    <nav
      class="site-dock"
      classList={{ "is-composer-open": composerOpen() }}
      aria-label={tr("ariaLabel")}>
      <Show
        when={auth.isAuthenticated()}
        fallback={
          <button
            type="button"
            class="item"
            aria-label={tr("signIn")}
            onClick={() => visitorAuth.open()}>
            <Icon name="account_circle" />
          </button>
        }>
        <div class="item user">
          <UserMenu />
        </div>
      </Show>
      <A
        class="item"
        href={pages.home}
        aria-label={tr("home")}
        aria-current={homeCurrent()}
        onClick={handleHomeClick}>
        <Icon name="home" />
      </A>
      <A
        class="item"
        href={pages.blips}
        aria-label={tr("blips")}
        aria-current={blipsCurrent()}>
        <BlipIcon
          size="1.375rem"
          class="site-dock-blip-icon"
        />
      </A>
      <span class="site-dock-menu-wrap">
      <Drawer
        side="bottom"
        open={menuOpen()}
        onOpenChange={setMenuOpen}
        class="user-menu-drawer site-dock-drawer"
        triggerClass="item menu"
        triggerIcon="menu"
        triggerIconClass="site-dock-menu-icon"
        triggerAriaLabel={tr("menu")}
        showClose={false}
        contentProps={{
          onOpenAutoFocus: event => event.preventDefault(),
        }}>
        <Stack
          class="user-menu-drawer-shell"
          style={menuBackground()}
          gap="0.75rem">
          <div class="handle" />
          <Stack
            class="user-menu-drawer-items"
            gap="0.5rem">
            <For each={navLinks()}>
              {link => (
                <button
                  type="button"
                  onClick={() => handleDrawerLinkClick(link)}
                  class={cx("user-menu-drawer-item", { active: link.isActive })}>
                  {link.path === pages.blips ? (
                    <BlipIcon
                      size="1.375rem"
                      class="menu-blip-icon"
                    />
                  ) : (
                    <Icon name={navIconByPath[link.path] ?? "chevron_right"} />
                  )}
                  <span>{link.label}</span>
                </button>
              )}
            </For>
          </Stack>
        </Stack>
      </Drawer>
      </span>
    </nav>
  )
}
