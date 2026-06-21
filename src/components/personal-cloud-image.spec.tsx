import { fireEvent, render } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalCloudImage } from "./personal-cloud-image"

const KEY = "media/u/b/photo"

const img = () =>
  document.querySelector("img.personal-cloud-image-img") as HTMLImageElement | null

beforeEach(() => {
  vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("PersonalCloudImage", () => {
  it("requests the dimension-picked variant for a complete image", () => {
    render(() => (
      <PersonalCloudImage
        imageKey={KEY}
        mimeType="image/jpeg"
        width={64}
        height={64}
        alt="thumb"
      />
    ))

    // 64px render context → micro variant.
    expect(img()?.getAttribute("src")).toBe(`https://cdn.test/${KEY}-micro.webp`)
  })

  it("falls back through WebP siblings before the original", () => {
    render(() => (
      <PersonalCloudImage
        imageKey={KEY}
        mimeType="image/jpeg"
        variant="micro"
        width={80}
        height={80}
      />
    ))

    const el = img()
    expect(el?.getAttribute("src")).toBe(`https://cdn.test/${KEY}-micro.webp`)

    fireEvent.error(el as HTMLImageElement)
    expect(img()?.getAttribute("src")).toBe(`https://cdn.test/${KEY}-small.webp`)
  })

  it("falls back variant → original → placeholder on load error", () => {
    render(() => (
      <PersonalCloudImage
        imageKey={KEY}
        mimeType="image/jpeg"
        width={2048}
        alt="full"
      />
    ))

    const el = img()
    expect(el?.getAttribute("src")).toBe(`https://cdn.test/${KEY}-large.webp`)

    fireEvent.error(el as HTMLImageElement)
    expect(img()?.getAttribute("src")).toBe(`https://cdn.test/${KEY}-original.jpg`)

    // Exhausting the candidates removes the <img> and leaves the placeholder.
    fireEvent.error(img() as HTMLImageElement)
    expect(img()).toBeNull()
    expect(
      document.querySelector(".personal-cloud-image-placeholder"),
    ).toBeTruthy()
  })

  it("honors an explicit variant override", () => {
    render(() => (
      <PersonalCloudImage
        imageKey={KEY}
        mimeType="image/jpeg"
        variant="medium"
        width={2048}
        alt="forced"
      />
    ))

    expect(img()?.getAttribute("src")).toBe(`https://cdn.test/${KEY}-medium.webp`)
  })

  it("shows a compact broken-image icon in small tiles instead of status text", () => {
    render(() => (
      <PersonalCloudImage
        imageKey={KEY}
        mimeType="image/jpeg"
        variant="micro"
        width={80}
        height={80}
      />
    ))

    let el = img()
    while (el) {
      fireEvent.error(el)
      el = img()
    }

    const placeholder = document.querySelector(".personal-cloud-image-placeholder")
    expect(placeholder?.querySelector("svg")).toBeTruthy()
    expect(placeholder?.querySelector("div")).toBeNull()
  })

  it("renders only the placeholder while processing is pending", () => {
    render(() => (
      <PersonalCloudImage
        imageKey={KEY}
        mimeType="image/jpeg"
        processingStatus="pending"
        width={1024}
        alt="pending"
      />
    ))

    expect(img()).toBeNull()
    expect(
      document.querySelector(".personal-cloud-image-placeholder"),
    ).toBeTruthy()
  })
})
