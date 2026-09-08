import { describe, expect, it } from "vitest"
import { getMainNavLinks } from "@/modules/home/components/main-nav"
import { pages } from "@/urls"

describe("getMainNavLinks", () => {
  it("marks the active path and keeps resume as a static destination", () => {
    const links = getMainNavLinks(pages.blips)

    expect(links.map(link => link.path)).toEqual([
      pages.home,
      pages.blips,
      pages.resume,
    ])
    expect(links.find(link => link.path === pages.blips)?.isActive).toBe(true)
    expect(links.find(link => link.path === pages.blips)?.label).toBe("Blips")
    expect(links.find(link => link.path === pages.resume)?.isStatic).toBe(true)
  })

  it("treats the home Signals section as the home destination", () => {
    const links = getMainNavLinks(pages.signals)

    expect(links.find(link => link.path === pages.home)?.isActive).toBe(true)
    expect(links.find(link => link.path === pages.blips)?.isActive).toBe(false)
  })
})
