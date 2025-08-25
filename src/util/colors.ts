import { withWindow } from "~/util/browser"

export function hexToRGB(hex, alpha = 1) {
  if (!hex) {
    return ""
  }

  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function generateRGBColorVarsFromHexVars() {
  const rgbColorVarsStyleTagID = "rgb-color-vars"

  withWindow(() => {
    if (document.getElementById(rgbColorVarsStyleTagID)) return

    const stylesheets = Array.from(document.styleSheets)
    const colorVars = {}

    stylesheets.forEach(stylesheet => {
      // Skip external stylesheets to avoid CORS issues
      if (stylesheet.href && !isLocalStylesheet(stylesheet.href)) {
        return
      }

      try {
        Array.from(stylesheet.cssRules).forEach(rule => {
          if (rule.type === CSSRule.STYLE_RULE) {
            const styleRule = rule as CSSStyleRule
            if (styleRule.selectorText === ":root") {
              Array.from(styleRule.style).forEach(variable => {
                if (
                  typeof variable === "string" &&
                  variable.startsWith("--colors")
                ) {
                  const value = styleRule.style
                    .getPropertyValue(variable)
                    .trim()
                  colorVars[variable] = value
                }
              })
            }
          }
        })
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        // Silently skip stylesheets that can't be accessed
      }
    })

    const rgbVars = []

    Object.entries(colorVars).forEach(([key, value]) => {
      if (typeof value !== "string") return

      let resolved = value

      const varRefMatch = value.match(/^var\((--colors-[^)]+)\)$/)
      if (varRefMatch) {
        const ref = varRefMatch[1]
        if (colorVars[ref] && typeof colorVars[ref] === "string") {
          resolved = colorVars[ref] as string
        }
      }

      const hexMatch = resolved.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
      if (!hexMatch) return

      const hex = hexMatch[0]
      let r, g, b

      if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16)
        g = parseInt(hex[2] + hex[2], 16)
        b = parseInt(hex[3] + hex[3], 16)
      } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16)
        g = parseInt(hex.slice(3, 5), 16)
        b = parseInt(hex.slice(5, 7), 16)
      } else {
        return
      }

      rgbVars.push(`${key}-rgb: ${r}, ${g}, ${b}`)
    })

    if (rgbVars.length > 0) {
      const stylesheet = document.createElement("style")
      stylesheet.type = "text/css"
      stylesheet.id = rgbColorVarsStyleTagID
      stylesheet.textContent = `:root {\n\t${rgbVars.join(";\n\t")};\n}`
      document.head.appendChild(stylesheet)
    }
  })
}

/**
 * Check if a stylesheet URL is from the same origin as the current page
 */
function isLocalStylesheet(href: string): boolean {
  try {
    const stylesheetUrl = new URL(href, window.location.origin)

    return stylesheetUrl.origin === window.location.origin
  } catch {
    // If URL parsing fails, assume it's external
    return false
  }
}
