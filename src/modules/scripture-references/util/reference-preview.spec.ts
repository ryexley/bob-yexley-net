import { describe, expect, it } from "vitest"
import { buildNormalizedReferencePreview } from "@/modules/scripture-references/util/reference-preview"

describe("buildNormalizedReferencePreview", () => {
  it("returns a normalized single-verse reference", () => {
    expect(buildNormalizedReferencePreview("John", "3", "16", "")).toBe("John 3:16")
  })

  it("returns a normalized verse range", () => {
    expect(buildNormalizedReferencePreview("Romans", "8", "28", "30")).toBe("Romans 8:28-30")
  })

  it("returns null for invalid verse ranges", () => {
    expect(buildNormalizedReferencePreview("Romans", "8", "28", "27")).toBeNull()
  })
})
