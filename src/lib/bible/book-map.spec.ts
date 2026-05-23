import { describe, expect, it } from "vitest"
import {
  bookAliases,
  CANONICAL_BOOK_NAMES,
  resolveBookAlias,
} from "@/lib/bible/book-map"

describe("book map", () => {
  it("covers all 66 canonical books as alias targets", () => {
    const canonicalValues = new Set(Object.values(bookAliases))

    expect(CANONICAL_BOOK_NAMES).toHaveLength(66)
    expect(canonicalValues.size).toBe(66)

    for (const book of CANONICAL_BOOK_NAMES) {
      expect(canonicalValues.has(book)).toBe(true)
    }
  })

  it("resolves common abbreviations from the scripture regex", () => {
    expect(resolveBookAlias("GEN")).toBe("Genesis")
    expect(resolveBookAlias("2PET")).toBe("2 Peter")
    expect(resolveBookAlias("2 Pet")).toBe("2 Peter")
    expect(resolveBookAlias("Rom")).toBe("Romans")
    expect(resolveBookAlias("1 Cor")).toBe("1 Corinthians")
    expect(resolveBookAlias("1Cor")).toBe("1 Corinthians")
    expect(resolveBookAlias("II Sam")).toBe("2 Samuel")
    expect(resolveBookAlias("Song of Songs")).toBe("Song of Solomon")
    expect(resolveBookAlias("SOS")).toBe("Song of Solomon")
    expect(resolveBookAlias("Jn")).toBe("John")
    expect(resolveBookAlias("1 Jn")).toBe("1 John")
    expect(resolveBookAlias("3 Jn")).toBe("3 John")
    expect(resolveBookAlias("Jude")).toBe("Jude")
    expect(resolveBookAlias("Rev")).toBe("Revelation")
  })

  it("returns null for unknown book aliases", () => {
    expect(resolveBookAlias("NotABook")).toBeNull()
    expect(resolveBookAlias("")).toBeNull()
  })
})
