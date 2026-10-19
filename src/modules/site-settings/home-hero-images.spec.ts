import { describe, expect, it } from "vitest"
import {
  DEFAULT_HOME_HERO_IMAGE_IDS,
  normalizeHeroImageIds,
  parseHeroImageIdInput,
  parseHeroImageIds,
  sameHeroImageIds,
} from "./home-hero-images"

describe("parseHeroImageIdInput", () => {
  it("accepts a descriptive Unsplash slug", () => {
    expect(
      parseHeroImageIdInput("green-forest-near-mountain-2z2CGEB7FIk"),
    ).toBe("green-forest-near-mountain-2z2CGEB7FIk")
  })

  it("extracts the last path segment from an Unsplash URL", () => {
    expect(
      parseHeroImageIdInput(
        "https://unsplash.com/photos/green-forest-near-mountain-2z2CGEB7FIk",
      ),
    ).toBe("green-forest-near-mountain-2z2CGEB7FIk")
  })

  it("strips query strings from a pasted URL", () => {
    expect(
      parseHeroImageIdInput(
        "https://unsplash.com/photos/2z2CGEB7FIk?utm_source=bob",
      ),
    ).toBe("2z2CGEB7FIk")
  })

  it("rejects empty and illegal values", () => {
    expect(parseHeroImageIdInput("")).toBeNull()
    expect(parseHeroImageIdInput("   ")).toBeNull()
    expect(parseHeroImageIdInput("../secret")).toBeNull()
    expect(parseHeroImageIdInput("has space")).toBeNull()
  })
})

describe("parseHeroImageIds", () => {
  it("returns the seeded defaults unchanged", () => {
    expect(parseHeroImageIds([...DEFAULT_HOME_HERO_IMAGE_IDS])).toEqual([
      ...DEFAULT_HOME_HERO_IMAGE_IDS,
    ])
  })

  it("drops blanks and duplicates while keeping order", () => {
    expect(
      parseHeroImageIds([
        "green-forest-near-mountain-2z2CGEB7FIk",
        "  ",
        "green-forest-near-mountain-2z2CGEB7FIk",
        "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
      ]),
    ).toEqual([
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ])
  })

  it("returns null for a missing or empty list", () => {
    expect(parseHeroImageIds(null)).toBeNull()
    expect(parseHeroImageIds("nope")).toBeNull()
    expect(parseHeroImageIds([])).toBeNull()
    expect(normalizeHeroImageIds(["", "  "])).toEqual([])
  })
})

describe("sameHeroImageIds", () => {
  it("compares lists by value and order", () => {
    expect(sameHeroImageIds(["a", "b"], ["a", "b"])).toBe(true)
    expect(sameHeroImageIds(["a", "b"], ["b", "a"])).toBe(false)
  })
})
