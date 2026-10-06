import { render } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { Icon } from "@/components/icon"
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
