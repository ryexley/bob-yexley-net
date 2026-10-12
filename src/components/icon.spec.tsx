import { render } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { Icon, ImagePlaceholder } from "@/components/icon"
import { iconGlyphs, type IconName } from "@/components/icon-registry"

const iconNames = Object.keys(iconGlyphs) as IconName[]

describe("Icon registry", () => {
  it("renders the official Lucide SVG children for every registered icon", () => {
    for (const name of iconNames) {
      const { container, unmount } = render(() => <Icon name={name} title={name} />)
      const svg = container.querySelector("svg")
      const glyph = iconGlyphs[name]
      const drawn = container.querySelectorAll("path, circle, rect, line")
      expect(svg, `${name} should render an svg`).toBeTruthy()
      expect(drawn.length, `${name} should keep every Lucide shape`).toBe(
        glyph.nodes.length,
      )
      expect(
        [...drawn].map(node => node.tagName.toLowerCase()),
        `${name} should keep Lucide tag order`,
      ).toEqual(glyph.nodes.map(node => node.tag))
      unmount()
    }
  })

  it("keeps official Lucide circles instead of converting them to paths", () => {
    const { container } = render(() => <Icon name="circleCheck" title="circleCheck" />)
    const circle = container.querySelector("circle")
    const path = container.querySelector("path")

    expect(circle?.getAttribute("cx")).toBe("12")
    expect(circle?.getAttribute("cy")).toBe("12")
    expect(circle?.getAttribute("r")).toBe("10")
    expect(path?.getAttribute("d")).toBe("m16 9-5.5 5.5L8 12")
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
