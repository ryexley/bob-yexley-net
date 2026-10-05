import { describe, expect, it } from "vitest"
import {
  BLIP_SLUG_MAX_LENGTH,
  blipSlugSource,
  deriveBlipSlug,
  normalizeBlipSlug,
  resolveBlipSlugRedirect,
  truncateSlug,
} from "@/modules/blips/slug"
import { blipPath, blipUrl } from "@/urls"

describe("normalizeBlipSlug", () => {
  it.each([
    ["College GameDay, Week 5!", "college-gameday-week-5"],
    ["Crème Brûlée à la mode", "creme-brulee-a-la-mode"],
    ["Straße ÆON Œuvre Ørsted", "strasse-aeon-oeuvre-orsted"],
    ["Hunter's highlights", "hunters-highlights"],
    ["It’s amazing", "its-amazing"],
    ["  --Hello--World--  ", "hello-world"],
    ["Church Notes - 10/4 @ Faith Promise", "church-notes-10-4-faith-promise"],
    ["TJC / Heaven and Hell", "tjc-heaven-and-hell"],
    ["ﬁne ½ ™", "fine-1-2-tm"],
    ["😀🎉", ""],
    ["", ""],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeBlipSlug(input)).toBe(expected)
  })

  it("handles null/undefined", () => {
    expect(normalizeBlipSlug(null)).toBe("")
    expect(normalizeBlipSlug(undefined)).toBe("")
  })

  it("is idempotent", () => {
    const once = normalizeBlipSlug(
      "The quick brown fox jumps over the lazy dog and keeps running far away",
    )
    expect(normalizeBlipSlug(once)).toBe(once)
  })
})

describe("slug length cap (60, whole words)", () => {
  it("drops whole trailing words from a long sentence until it fits", () => {
    const slug = normalizeBlipSlug(
      "The quick brown fox jumps over the lazy dog and keeps running far away",
    )
    // "...-keeps" is 53 chars; adding "-running" would make 61.
    expect(slug).toBe("the-quick-brown-fox-jumps-over-the-lazy-dog-and-keeps")
    expect(slug.length).toBeLessThanOrEqual(BLIP_SLUG_MAX_LENGTH)
  })

  it("keeps a slug of exactly 60 characters", () => {
    const sixty = `${"a".repeat(29)}-${"b".repeat(30)}`
    expect(sixty).toHaveLength(60)
    expect(normalizeBlipSlug(sixty)).toBe(sixty)
  })

  it("keeps a word that ends exactly at 60 when a dash follows", () => {
    expect(normalizeBlipSlug(`${"x".repeat(60)} next`)).toBe("x".repeat(60))
  })

  it("never cuts mid-word when a shorter whole-word prefix exists", () => {
    expect(normalizeBlipSlug(`abc ${"y".repeat(57)}`)).toBe("abc")
  })

  it("hard-cuts only a single first word longer than 60", () => {
    const slug = normalizeBlipSlug(
      "Supercalifragilisticexpialidociousandthensomemoreletterstomakeitlonger then short",
    )
    expect(slug).toBe(
      "supercalifragilisticexpialidociousandthensomemoreletterstoma",
    )
    expect(slug).toHaveLength(60)
  })

  it("never leaves a trailing dash", () => {
    expect(truncateSlug(`${"a".repeat(59)}-b-c`)).toBe("a".repeat(59))
    expect(normalizeBlipSlug("word ".repeat(30))).toMatch(
      /^[a-z0-9-]*[a-z0-9]$/,
    )
  })
})

describe("blipSlugSource / deriveBlipSlug", () => {
  it("prefers the title column", () => {
    expect(deriveBlipSlug({ title: "My Title", content: "### Heading" })).toBe(
      "my-title",
    )
  })

  it("uses the first markdown heading", () => {
    expect(
      deriveBlipSlug({
        title: null,
        content: "### College Gameday - week 5\n\nI think it's fair to say.",
      }),
    ).toBe("college-gameday-week-5")
  })

  it("strips emphasis and links in headings", () => {
    expect(
      deriveBlipSlug({ content: "#### *Game Plan* [today](https://x.y/z)" }),
    ).toBe("game-plan-today")
  })

  it("falls back to the first sentence of the body", () => {
    expect(
      deriveBlipSlug({
        content: "Happy **Dolly Parton** day world. 9/25. Get it? 9 to 5?",
      }),
    ).toBe("happy-dolly-parton-day-world")
  })

  it("does not split sentences on dots inside words/urls", () => {
    expect(blipSlugSource(null, "Upgraded to v2.0 today! Nice")).toBe(
      "Upgraded to v2.0 today",
    )
    expect(deriveBlipSlug({ content: "Upgraded to v2.0 today! Nice" })).toBe(
      "upgraded-to-v2-0-today",
    )
  })

  it("skips blockquote/list markers and empty lines", () => {
    expect(
      deriveBlipSlug({
        content: "\n\n> Be curious, not judgmental.\n>\n> -- Ted",
      }),
    ).toBe("be-curious-not-judgmental")
    expect(deriveBlipSlug({ content: "* 1 Peter 3:8-9\n* more" })).toBe(
      "1-peter-3-8-9",
    )
  })

  it("ignores media/audio embeds, images, html and bare urls", () => {
    expect(
      deriveBlipSlug({
        content:
          '{media:{key:"media/abc/1.jpg",alt:"x"}}\n\n![photo](https://e.x/p.jpg)<br />https://example.com/a.b\n\nFinally some text. More',
      }),
    ).toBe("finally-some-text")
  })

  it("uses link text, not the url", () => {
    expect(
      deriveBlipSlug({
        content:
          "As I sit here on [having just blipped](https://bob.yexley.net/blips/1), a thought",
      }),
    ).toBe("as-i-sit-here-on-having-just-blipped-a-thought")
  })

  it("returns empty for media-only blips", () => {
    expect(deriveBlipSlug({ content: '{media:{key:"media/a.jpg"}}' })).toBe("")
    expect(deriveBlipSlug({ content: "" })).toBe("")
    expect(deriveBlipSlug(null)).toBe("")
  })

  it("caps long first sentences at whole words", () => {
    expect(
      deriveBlipSlug({
        content:
          "**Youth sports parents**: if you sign your kid up to play, do your kid, their teammates, a favor.",
      }),
    ).toBe("youth-sports-parents-if-you-sign-your-kid-up-to-play-do-your")
  })
})

describe("blipPath / blipUrl", () => {
  it("builds /blips/{id}/{slug}", () => {
    expect(
      blipPath({ id: "20261003131057727", slug: "college-gameday-week-5" }),
    ).toBe("/blips/20261003131057727/college-gameday-week-5")
  })

  it("falls back to /blips/{id} without a slug", () => {
    expect(blipPath({ id: "20261003131057727", slug: null })).toBe(
      "/blips/20261003131057727",
    )
    expect(blipPath({ id: "20261003131057727", slug: "  " })).toBe(
      "/blips/20261003131057727",
    )
    expect(blipPath({ id: "20261003131057727" })).toBe(
      "/blips/20261003131057727",
    )
    expect(blipPath("20261003131057727")).toBe("/blips/20261003131057727")
  })

  it("builds absolute urls", () => {
    expect(blipUrl("https://bob.yexley.net/", { id: "1", slug: "a-b" })).toBe(
      "https://bob.yexley.net/blips/1/a-b",
    )
  })
})

describe("resolveBlipSlugRedirect", () => {
  const blip = { id: "20261003131057727", slug: "college-gameday-week-5" }

  it("does not redirect plain /blips/{id}", () => {
    expect(resolveBlipSlugRedirect(undefined, blip)).toBeNull()
  })

  it("does not redirect the current slug", () => {
    expect(resolveBlipSlugRedirect("college-gameday-week-5", blip)).toBeNull()
  })

  it("redirects stale, mistyped or wrong-case slugs to the canonical path", () => {
    for (const requested of [
      "college-gameday",
      "College-GameDay-Week-5",
      "x",
    ]) {
      expect(resolveBlipSlugRedirect(requested, blip)).toBe(
        "/blips/20261003131057727/college-gameday-week-5",
      )
    }
  })

  it("redirects any slug to /blips/{id} when the blip has none", () => {
    expect(resolveBlipSlugRedirect("anything", { id: "1", slug: null })).toBe(
      "/blips/1",
    )
    expect(
      resolveBlipSlugRedirect(undefined, { id: "1", slug: null }),
    ).toBeNull()
  })

  it("does nothing while the blip is unknown (404 is handled separately)", () => {
    expect(resolveBlipSlugRedirect("anything", null)).toBeNull()
    expect(resolveBlipSlugRedirect("anything", undefined)).toBeNull()
  })
})
