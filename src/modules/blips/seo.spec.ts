import { describe, it, expect } from "vitest"
import {
  deriveBlipTitle,
  deriveBlipDescription,
  resolveBlipTitle,
  formatPageTitle,
  formatTagTitle,
  formatTagDescription,
} from "./seo"

/**
 * Production blip 20261024205558124 (the 2026-10-24 evening walk). Live RSS
 * and RCS share cards currently use this raw embed as og:title.
 */
const WAYHILL_MEDIA_EMBED =
  '{media:{key:"media/f4e01a2c-f284-4bb0-b7f4-65d4b3400ddb/20261024205558124/sc-20261024205606",type:"image",mime:"image/png",lightbox:true}}'

const WAYHILL_BODY =
  "Was a tough week in terms of schedule and time, and I didn’t get out and walk as much this week as I would have preferred."

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
    const content =
      "This has **bold** and *italic* and `code` and [a link](url) and ![an image](img.jpg)."
    const result = deriveBlipTitle(content)
    expect(result).not.toContain("**")
    expect(result).not.toContain("*")
    expect(result).not.toContain("`")
    expect(result).not.toContain("[")
    expect(result).not.toContain("](")
  })

  it("truncates long titles at word boundary", () => {
    const content =
      "This is a very long sentence that exceeds the maximum length and should be truncated at a word boundary."
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
    const content =
      "```javascript\nconst x = 1;\n```\n\nThis is the actual text."
    expect(deriveBlipTitle(content)).toBe("This is the actual text")
  })

  it("never joins heading and body", () => {
    const content = "# Heading\n\nBody text here."
    expect(deriveBlipTitle(content)).toBe("Heading")
  })

  it("skips an X embed when deriving a title", () => {
    const content =
      '{x:{url:"https://x.com/stephenthompson/status/123"}}\n\n# College gameday\n\nWhat a mess.'
    expect(deriveBlipTitle(content)).toBe("College gameday")
  })

  it("uses the heading after a leading media embed", () => {
    const content = `${WAYHILL_MEDIA_EMBED}\n\n# Award-Winning Wayhill walk\n\nWent for a walk.`
    expect(deriveBlipTitle(content)).toBe("Award-Winning Wayhill walk")
    expect(deriveBlipTitle(content)).not.toMatch(/\{media:/)
  })

  it("uses the first sentence after a leading media embed", () => {
    const content = `${WAYHILL_MEDIA_EMBED}\n\n${WAYHILL_BODY} Cool evening hike.`
    const title = deriveBlipTitle(content)
    expect(title).toMatch(/^Was a tough week/)
    expect(title).not.toMatch(/\{media:/)
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it("does not use media embed syntax as the title", () => {
    expect(deriveBlipTitle(WAYHILL_MEDIA_EMBED)).toBe("")
    expect(deriveBlipTitle(WAYHILL_MEDIA_EMBED)).not.toContain("{media:")
    expect(deriveBlipTitle(WAYHILL_MEDIA_EMBED)).not.toContain("f4e01a2c")
  })

  it("reproduces the leaked RCS share title from the 2026-10-24 walk", () => {
    const content = `${WAYHILL_MEDIA_EMBED}

Was a tough week in terms of schedule and time, and I didn’t get out and walk as much this week as I would have preferred. Because of that, I made sure to get out this evening, and even tacked on an extra lap this evening. Walked 8 laps up and down the hill this evening. Little extra to help burn off the stress of both the Ducks *and* the Vols losing today. ugh
`
    const title = deriveBlipTitle(content)
    const description = deriveBlipDescription(content)
    expect(title).toBe("Was a tough week in terms of schedule and time, and I")
    expect(title).not.toMatch(/\{media:/)
    expect(title).not.toContain("f4e01a2c")
    expect(description).toMatch(/^Was a tough week/)
    expect(description).not.toMatch(/\{media:/)
  })

  it("never leaks raw embed tokens into share-link titles", () => {
    const cases = [
      WAYHILL_MEDIA_EMBED,
      '{media:{ key: "media/u/b/shot", type: "image" }}',
      '{audio:{src:"/audio/ep-1.mp3",title:"Episode 1"}}',
      '{x:{url:"https://x.com/stephenthompson/status/123"}}',
      '{future:{key:"media/u/b/shot",type:"hologram"}}',
    ]
    for (const content of cases) {
      const title = deriveBlipTitle(content)
      expect(title, content).not.toMatch(/\{[a-z]+:/)
      expect(title, content).not.toContain("media/")
    }
  })

  it("skips audio embeds when deriving a title", () => {
    const content =
      '{audio:{src:"/audio/ep-1.mp3",title:"Episode 1"}}\n\nListening notes from tonight.'
    expect(deriveBlipTitle(content)).toBe("Listening notes from tonight")
  })
})

describe("deriveBlipDescription", () => {
  it("excludes the first heading", () => {
    const content = "# Heading\n\nThis is the body text."
    expect(deriveBlipDescription(content)).toBe("This is the body text.")
  })

  it("strips markdown formatting", () => {
    const content =
      "Body with **bold** and *italic* and `code` and [link](url)."
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
    const content =
      "Check out ![this image](img.jpg) and [this link](url) for more info."
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

  it("excludes a leading media embed from the description", () => {
    const content = `${WAYHILL_MEDIA_EMBED}\n\n${WAYHILL_BODY}`
    const description = deriveBlipDescription(content)
    expect(description).toMatch(/^Was a tough week/)
    expect(description).not.toContain("{media:")
    expect(description).not.toContain("f4e01a2c")
  })
})

describe("resolveBlipTitle", () => {
  it("prefers the stored title over content", () => {
    expect(
      resolveBlipTitle({
        title: "Stored Title",
        content: "# Heading in content",
      }),
    ).toBe("Stored Title")
  })

  it("falls back to a derived title when the stored title is blank", () => {
    expect(
      resolveBlipTitle({
        title: "   ",
        content: `${WAYHILL_MEDIA_EMBED}\n\n# Award-Winning Wayhill walk`,
      }),
    ).toBe("Award-Winning Wayhill walk")
  })

  it("returns empty for a media-only blip with no title", () => {
    expect(
      resolveBlipTitle({
        title: null,
        content: WAYHILL_MEDIA_EMBED,
      }),
    ).toBe("")
  })
})

describe("formatPageTitle", () => {
  it("appends site name to page title", () => {
    expect(formatPageTitle("About")).toBe("About · Bob Yexley")
  })
})

describe("formatTagTitle", () => {
  it("formats tag title correctly", () => {
    expect(formatTagTitle("football")).toBe(
      'Blips tagged "football" · Bob Yexley',
    )
  })
})

describe("formatTagDescription", () => {
  it("formats tag description correctly", () => {
    expect(formatTagDescription("football")).toBe(
      'View all blips tagged with "football"',
    )
  })
})
