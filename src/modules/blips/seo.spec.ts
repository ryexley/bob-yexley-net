import { describe, it, expect } from "vitest"
import {
  deriveBlipTitle,
  deriveBlipDescription,
  formatPageTitle,
  formatTagTitle,
  formatTagDescription,
} from "./seo"

describe("deriveBlipTitle", () => {
  it("extracts the first markdown heading", () => {
    const content = "# Main Heading\n\nSome body text here."
    expect(deriveBlipTitle(content)).toBe("Main Heading")
  })

  it("extracts h2-h6 headings", () => {
    expect(deriveBlipTitle("## Second Level")).toBe("Second Level")
    expect(deriveBlipTitle("### Third Level")).toBe("Third Level")
    expect(deriveBlipTitle("###### Sixth Level")).toBe("Sixth Level")
  })

  it("falls back to first sentence when no heading", () => {
    const content = "This is the first sentence. This is the second."
    expect(deriveBlipTitle(content)).toBe("This is the first sentence")
  })

  it("strips markdown formatting from fallback text", () => {
    const content = "This has **bold** and *italic* and `code` and [a link](url) and ![an image](img.jpg)."
    const result = deriveBlipTitle(content)
    expect(result).not.toContain("**")
    expect(result).not.toContain("*")
    expect(result).not.toContain("`")
    expect(result).not.toContain("[")
    expect(result).not.toContain("](")
  })

  it("truncates long titles at word boundary", () => {
    const content = "This is a very long sentence that exceeds the maximum length and should be truncated at a word boundary."
    const result = deriveBlipTitle(content, 60)
    expect(result.length).toBeLessThanOrEqual(60)
    expect(result).not.toMatch(/\s$/)
    expect(result.split(" ").every(word => word.length > 0)).toBe(true)
  })

  it("does not truncate titles shorter than maxLength", () => {
    const content = "Short title here."
    expect(deriveBlipTitle(content, 60)).toBe("Short title here")
  })

  it("handles code blocks", () => {
    const content = "```javascript\nconst x = 1;\n```\n\nThis is the actual text."
    expect(deriveBlipTitle(content)).toBe("This is the actual text")
  })

  it("never joins heading and body", () => {
    const content = "# Heading\n\nBody text here."
    expect(deriveBlipTitle(content)).toBe("Heading")
  })
})

describe("deriveBlipDescription", () => {
  it("excludes the first heading", () => {
    const content = "# Heading\n\nThis is the body text."
    expect(deriveBlipDescription(content)).toBe("This is the body text.")
  })

  it("strips markdown formatting", () => {
    const content = "Body with **bold** and *italic* and `code` and [link](url)."
    const result = deriveBlipDescription(content)
    expect(result).not.toContain("**")
    expect(result).not.toContain("*")
    expect(result).not.toContain("`")
    expect(result).not.toContain("[")
    expect(result).not.toContain("](")
  })

  it("truncates long descriptions at word boundary with ellipsis", () => {
    const longText = "A".repeat(200)
    const result = deriveBlipDescription(longText, 155)
    expect(result.length).toBeLessThanOrEqual(159) // 155 + "..."
    expect(result.endsWith("...")).toBe(true)
  })

  it("does not add ellipsis for short descriptions", () => {
    const content = "Short description."
    expect(deriveBlipDescription(content)).toBe("Short description.")
  })

  it("handles content with only a heading", () => {
    const content = "# Just a heading"
    expect(deriveBlipDescription(content)).toBe("")
  })

  it("removes images and links properly", () => {
    const content = "Check out ![this image](img.jpg) and [this link](url) for more info."
    const result = deriveBlipDescription(content)
    expect(result).toContain("Check out")
    expect(result).toContain("and")
    expect(result).toContain("for more info")
    expect(result).not.toContain("![")
    expect(result).not.toContain("](")
  })

  it("handles code blocks", () => {
    const content = "Description with ```code block``` inside."
    const result = deriveBlipDescription(content)
    expect(result).not.toContain("```")
  })
})

describe("formatPageTitle", () => {
  it("appends site name to page title", () => {
    expect(formatPageTitle("About")).toBe("About · Bob Yexley")
  })
})

describe("formatTagTitle", () => {
  it("formats tag title correctly", () => {
    expect(formatTagTitle("football")).toBe('Blips tagged "football" · Bob Yexley')
  })
})

describe("formatTagDescription", () => {
  it("formats tag description correctly", () => {
    expect(formatTagDescription("football")).toBe('View all blips tagged with "football"')
  })
})
