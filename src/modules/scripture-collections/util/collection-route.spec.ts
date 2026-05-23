import { describe, expect, it } from "vitest"
import type { AdminCollectionRecord } from "@/modules/scripture-collections/data/types"
import {
  findCollectionByRouteParam,
  isCanonicalCollectionRouteParam,
} from "@/modules/scripture-collections/util/collection-route"

const collections: AdminCollectionRecord[] = [
  {
    id: 1,
    name: "Favorites",
    description: null,
    slug: "favorites",
    referenceCount: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 42,
    name: "Numeric slug",
    description: null,
    slug: "42",
    referenceCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
]

describe("findCollectionByRouteParam", () => {
  it("resolves collections by slug", () => {
    expect(findCollectionByRouteParam(collections, "favorites")?.id).toBe(1)
  })

  it("resolves collections by numeric id when slug does not match", () => {
    expect(findCollectionByRouteParam(collections, "1")?.slug).toBe("favorites")
  })

  it("prefers slug matches over numeric ids", () => {
    expect(findCollectionByRouteParam(collections, "42")?.name).toBe("Numeric slug")
  })
})

describe("isCanonicalCollectionRouteParam", () => {
  it("accepts slug params only", () => {
    expect(isCanonicalCollectionRouteParam(collections[0], "favorites")).toBe(true)
    expect(isCanonicalCollectionRouteParam(collections[0], "1")).toBe(false)
  })
})
