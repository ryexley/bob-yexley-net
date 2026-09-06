import { pages } from "@/urls"
import { ptr } from "@/i18n"
import { withWindow } from "@/util/browser"

const tr = ptr("home.components.mainHeader.nav")

export type MainNavLink = {
  path: string
  label: string
  isActive: boolean
  isStatic?: boolean
}

export const getMainNavLinks = (activePath: string): MainNavLink[] => [
  {
    path: pages.home,
    label: tr("home"),
    isActive: activePath === pages.home,
  },
  {
    path: pages.blips,
    label: tr("blips"),
    isActive: activePath === pages.blips || activePath.startsWith(`${pages.blips}/`),
  },
  {
    path: pages.resume,
    label: tr("resume"),
    isActive: activePath === pages.resume,
    isStatic: true,
  },
]

export const scrollToHomeSectionIfPresent = (path: string): boolean => {
  const sectionIdByPath: Record<string, string> = {
    [pages.home]: "home",
    [pages.signals]: "signals",
  }

  const sectionId = sectionIdByPath[path]
  if (!sectionId) {
    return false
  }

  let didScroll = false

  withWindow((window: Window) => {
    const target = window.document.querySelector(
      `[data-home-section-id="${sectionId}"]`,
    )

    if (!(target instanceof HTMLElement)) {
      return
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
    window.history.replaceState(null, "", path)
    window.dispatchEvent(
      new CustomEvent("main-nav-path-changed", {
        detail: { path },
      }),
    )
    didScroll = true
  })

  return didScroll
}

export const assignPath = (path: string) => {
  withWindow((window: Window) => {
    window.location.assign(path)
  })
}
