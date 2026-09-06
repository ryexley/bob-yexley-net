import {
  createMemo,
  createSignal,
  For,
  splitProps,
  onMount,
  onCleanup,
} from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import {
  assignPath,
  getMainNavLinks,
  scrollToHomeSectionIfPresent,
} from "@/modules/home/components/main-nav"
import { clsx as cx } from "@/util"
import "./main-header.css"

export function MainHeader(props: any) {
  const [local] = splitProps(props, ["meta", "onNavItemClick"])
  const location = useLocation()
  const routerNavigate = useNavigate()
  const [activePath, setActivePath] = createSignal(location.pathname)

  const navLinks = createMemo(() => {
    if (local.meta) {
      return local.meta()
    }

    return getMainNavLinks(activePath())
  })

  const navigate = (path: string, fullPage = false) => {
    setActivePath(path)
    if (fullPage) {
      assignPath(path)
      return
    }

    routerNavigate(path)
  }

  const handleNavClick = (e, link) => {
    if (link.isStatic) {
      e.preventDefault()
      navigate(link.path, true)
      return
    }

    if (local.onNavItemClick) {
      local.onNavItemClick(e, link.path)
      return
    }

    const didScroll = scrollToHomeSectionIfPresent(link.path)
    if (didScroll) {
      e.preventDefault()
      setActivePath(link.path)
      return
    }

    e.preventDefault()
    navigate(link.path)
  }

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
    </header>
  )
}
