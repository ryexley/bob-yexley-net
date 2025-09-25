import {
  createMemo,
  createSignal,
  createEffect,
  For,
  splitProps,
  onMount,
  onCleanup,
} from "solid-js"
import { useLocation } from "@solidjs/router"
import { Drawer } from "@/components/drawer"
import { Stack } from "@/components/stack"
import { pages } from "@/urls"
import { clsx as cx } from "@/util"
import { tr } from "@/i18n"
import { withWindow } from "@/util/browser"
import "./main-header.css"

export function MainHeader(props: any) {
  const [local] = splitProps(props, ["meta", "onNavItemClick"])
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = createSignal(false)
  const [activePath, setActivePath] = createSignal(location.pathname)
  const [pendingMobileNavLink, setPendingMobileNavLink] = createSignal<any>(null)

  const navLinks = createMemo(() => {
    const dynamicLinks = local.meta?.() || [
      {
        path: pages.home,
        label: "Home",
        isActive: activePath() === pages.home,
      },
      {
        path: pages.signals,
        label: "Signals",
        isActive: activePath() === pages.signals,
      },
    ]

    const staticLinks = [
      {
        path: pages.resume,
        label: "Resume",
        isActive: activePath() === pages.resume,
      },
    ].map(link => ({ ...link, isStatic: true }))

    return [...dynamicLinks, ...staticLinks]
  })

  const scrollToHomeSectionIfPresent = (path: string): boolean => {
    const sectionIdByPath = {
      [pages.home]: "home",
      [pages.signals]: "signals",
    }

    const sectionId = sectionIdByPath[path]
    if (!sectionId) {
      return false
    }

    let didScroll = false

    withWindow((window: Window) => {
      const selector = `[data-home-section-id="${sectionId}"]`
      const target = window.document.querySelector(selector)

      if (!(target instanceof HTMLElement)) {
        return
      }

      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
      window.history.replaceState(null, "", path)
      setActivePath(path)
      didScroll = true
    })

    return didScroll
  }

  const navigate = (path: string) => {
    setActivePath(path)
    withWindow((window: Window) => {
      window.location.assign(path)
    })
  }

  const runNavAction = (e, link) => {
    if (link.isStatic) {
      e.preventDefault()
      navigate(link.path)
      return
    }

    if (local.onNavItemClick) {
      local.onNavItemClick(e, link.path)
      return
    }

    const didScroll = scrollToHomeSectionIfPresent(link.path)
    if (didScroll) {
      e.preventDefault()
      return
    }

    e.preventDefault()
    navigate(link.path)
  }

  const onMobileNavClick = (e, link) => {
    e.preventDefault()
    setPendingMobileNavLink(link)
    setMobileNavOpen(false)
  }

  const handleNavClick = (e, link) => {
    runNavAction(e, link)
  }

  const handleMobileNavOpenChange = (open: boolean) => {
    if (open) {
      withWindow((window: Window) => {
        setActivePath(window.location.pathname)
      })
    }
    setMobileNavOpen(open)
  }

  createEffect(() => {
    const nextLink = pendingMobileNavLink()
    if (!nextLink || mobileNavOpen()) {
      return
    }

    const fakeEvent = {
      preventDefault: () => {},
    }
    runNavAction(fakeEvent, nextLink)
    setPendingMobileNavLink(null)
  })

  onMount(() => {
    const syncActivePath = () => {
      setActivePath(location.pathname)
    }

    const onMainNavPathChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ path?: string }>
      const nextPath = customEvent.detail?.path
      if (nextPath) {
        setActivePath(nextPath)
        return
      }

      syncActivePath()
    }

    window.addEventListener("popstate", syncActivePath)
    window.addEventListener("main-nav-path-changed", onMainNavPathChanged)

    onCleanup(() => {
      window.removeEventListener("popstate", syncActivePath)
      window.removeEventListener("main-nav-path-changed", onMainNavPathChanged)
    })
  })

  return (
    <header class="main-header">
      {/*
      <a
        href={pages.home}
        class="flex !py-3 !px-5"
        onClick={e => local.onNavItemClick(e, pages.home)}>
        {tr("site.title")}
      </a>
      */}
      <span />
      <nav class="desktop-nav">
        <For each={navLinks()}>
          {link => (
            <a
              href={link.path}
              onClick={e => handleNavClick(e, link)}
              class={cx("desktop-nav-link", {
                active: link.isActive,
              })}>
              {link.label}
            </a>
          )}
        </For>
      </nav>
      <Drawer
        open={mobileNavOpen()}
        onOpenChange={handleMobileNavOpenChange}
        class="mobile-nav"
        headerClass="h-[var(--main-header-height)] justify-center"
        title={tr("home.components.mainHeader.mobileNav.title")}
        triggerClass="mobile-nav-trigger"
        triggerIconClass="mobile-nav-trigger-icon"
        closeIcon="chevron_right"
        closeClass="mobile-nav-close"
        closeIconClass="mobile-nav-close-icon">
        <Stack
          gap="0"
          class="mobile-nav-list">
          <For each={navLinks()}>
            {link => (
              <a
                href={link.path}
                onClick={e => onMobileNavClick(e, link)}
                class={cx("mobile-nav-link", { active: link.isActive })}>
                {link.label}
              </a>
            )}
          </For>
          <hr class="mobile-nav-divider" />
        </Stack>
      </Drawer>
    </header>
  )
}
