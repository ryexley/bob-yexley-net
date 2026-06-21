import { afterEach, describe, expect, it } from "vitest"
import { lockDocumentScroll } from "./scroll-lock"

afterEach(() => {
  document.documentElement.style.overflow = ""
  document.body.style.overflow = ""
  document.body.style.paddingRight = ""
})

describe("lockDocumentScroll", () => {
  it("locks and restores html/body overflow", () => {
    document.documentElement.style.overflow = "auto"
    document.body.style.overflow = "visible"

    const unlock = lockDocumentScroll()

    expect(document.documentElement.style.overflow).toBe("hidden")
    expect(document.body.style.overflow).toBe("hidden")

    unlock()

    expect(document.documentElement.style.overflow).toBe("auto")
    expect(document.body.style.overflow).toBe("visible")
  })

  it("keeps the lock until the last nested unlock", () => {
    const unlockA = lockDocumentScroll()
    const unlockB = lockDocumentScroll()

    unlockA()
    expect(document.body.style.overflow).toBe("hidden")

    unlockB()
    expect(document.body.style.overflow).toBe("")
  })
})
