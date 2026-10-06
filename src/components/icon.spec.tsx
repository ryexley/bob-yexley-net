import { render } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { Icon, ImagePlaceholder } from "@/components/icon"
import { iconGlyphs, type IconName } from "@/components/icon-registry"

const iconNames = Object.keys(iconGlyphs) as IconName[]

describe("Icon registry", () => {
  it("renders a path for every registered icon without throwing", () => {
    for (const name of iconNames) {
      const { container, unmount } = render(() => <Icon name={name} title={name} />)
      const svg = container.querySelector("svg")
      const paths = container.querySelectorAll("path")
      expect(svg, `${name} should render an svg`).toBeTruthy()
      expect(paths.length, `${name} should have at least one path`).toBeGreaterThan(0)
      expect(
        [...paths].every(path => path.getAttribute("d")?.length),
        `${name} paths should have d data`,
      ).toBe(true)
      unmount()
    }
  })
})

describe("ImagePlaceholder", () => {
  it("does not apply the toolbar .icon size lock so layout classes can enlarge it", () => {
    const { container } = render(() => (
      <ImagePlaceholder class="relative h-1/2 w-1/2 max-h-40" />
    ))
    const svg = container.querySelector("svg")

    expect(svg?.classList.contains("icon")).toBe(false)
    expect(svg?.classList.contains("h-1/2")).toBe(true)
    expect(svg?.classList.contains("w-1/2")).toBe(true)
    expect(svg?.classList.contains("max-h-40")).toBe(true)
  })
})
