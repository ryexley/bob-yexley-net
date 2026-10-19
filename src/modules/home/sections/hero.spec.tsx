import { render } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Hero } from "@/modules/home/sections/hero"
import { DEFAULT_HOME_HERO_IMAGE_IDS } from "@/modules/site-settings/home-hero-images"

const { heroImageIds } = vi.hoisted(() => ({
  heroImageIds: {
    value: ["custom-hero-image-abc123XYZ"],
  },
}))

vi.mock("@solidjs/router", () => ({
  createAsync: () => () => heroImageIds.value,
  query: (fn: unknown) => fn,
}))

vi.mock("@/modules/site-settings/data/queries", () => ({
  getHomeHeroImageIds: vi.fn(),
}))

vi.mock("@/util/random", () => ({
  randomIndex: (target: unknown[]) => Math.max(target.length - 1, 0),
}))

vi.mock("@/components/image", () => ({
  UnsplashImage: (props: any) => (
    <img
      alt={props.alt}
      data-testid="hero-unsplash"
      data-image-id={props.imageId}
    />
  ),
  CloudinaryImage: () => <img alt="portrait" />,
}))

vi.mock("@/modules/home/components/page-section", () => ({
  PageSection: (props: any) => <section>{props.children}</section>,
}))

vi.mock("@/lib/vendor/unsplash", () => ({
  preloadUnsplashImages: vi.fn(async () => undefined),
}))

vi.mock("@/i18n", () => ({
  tr: (key: string) => key,
}))

describe("Hero", () => {
  beforeEach(() => {
    heroImageIds.value = ["custom-hero-image-abc123XYZ"]
  })

  it("uses the hero image ids from site settings", () => {
    render(() => <Hero />)

    expect(
      document
        .querySelector("[data-testid='hero-unsplash']")
        ?.getAttribute("data-image-id"),
    ).toBe("custom-hero-image-abc123XYZ")
  })

  it("can pick a newly added image even when the hardcoded defaults remain", () => {
    const addedImageId = "newly-added-hero-image-ONLY123"
    heroImageIds.value = [...DEFAULT_HOME_HERO_IMAGE_IDS, addedImageId]

    render(() => <Hero />)

    expect(
      document
        .querySelector("[data-testid='hero-unsplash']")
        ?.getAttribute("data-image-id"),
    ).toBe(addedImageId)
  })
})
