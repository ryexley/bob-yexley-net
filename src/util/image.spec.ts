import { describe, expect, it, vi } from "vitest"
import { generateRandomRadialGradients } from "./image"

vi.mock("@/util/random", () => ({
  random: vi.fn((min: number) => min),
}))

describe("generateRandomRadialGradients", () => {
  it("emits rem-sized blobs using sizeMin and sizeMax", () => {
    const result = generateRandomRadialGradients({
      count: 1,
      sizeMin: 0.25,
      sizeMax: 0.5,
      palette: ["rgba(0, 0, 0, 0.3)"],
    })

    // random() always returns min → radius = 0.25 + 0.5/2 = 0.5rem, fade floored to 100%
    expect(result).toBe(
      "radial-gradient(circle 0.5rem at 0% 0%, rgba(0, 0, 0, 0.3) 0%, transparent 100%)",
    )
  })

  it("applies a custom opacity to palette colors", () => {
    const result = generateRandomRadialGradients({
      count: 1,
      opacity: 0.55,
      palette: ["rgba(24, 36, 73, 0.3)"],
    })

    expect(result).toContain("rgba(24, 36, 73, 0.55)")
  })

  it("floors compact fade stops at 100% so blobs stay visible", () => {
    const result = generateRandomRadialGradients({
      count: 1,
      sizeMin: 0.125,
      sizeMax: 0.5,
      palette: ["rgba(0, 0, 0, 0.3)"],
    })

    expect(result).toContain("transparent 100%)")
    expect(result).not.toMatch(/transparent [0-9]{1,2}%/)
  })

  it("keeps large-placeholder defaults in rem", () => {
    const result = generateRandomRadialGradients({
      count: 1,
      palette: ["rgba(0, 0, 0, 0.3)"],
    })

    // sizeMin 3.125 + sizeMax/2 4.6875 = 7.8125rem (~125px, legacy minimum)
    expect(result).toBe(
      "radial-gradient(circle 7.8125rem at 0% 0%, rgba(0, 0, 0, 0.3) 0%, transparent 125%)",
    )
  })
})
