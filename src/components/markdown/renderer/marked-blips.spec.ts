import { describe, expect, it } from "vitest"
import { parseBlipMarkdown } from "./marked-blips"

describe("parseBlipMarkdown", () => {
  it("renders ==highlight== as marked highlight text", () => {
    expect(parseBlipMarkdown("Before ==highlighted== after")).toContain(
      "<mark class=\"highlight\">highlighted</mark>",
    )
  })

  it("renders nested inline markdown inside highlight text", () => {
    expect(parseBlipMarkdown("==**important**==")).toContain(
      "<mark class=\"highlight\"><strong>important</strong></mark>",
    )
  })
})
