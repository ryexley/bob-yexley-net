import { describe, expect, it } from "vitest"
import { stripEsvShortCopyright } from "@/lib/bible/strip-esv-short-copyright"

describe("stripEsvShortCopyright", () => {
  it("removes the short ESV copyright suffix", () => {
    expect(stripEsvShortCopyright("Jesus wept. (ESV)")).toBe("Jesus wept.")
  })

  it("leaves passage text unchanged when no suffix is present", () => {
    expect(stripEsvShortCopyright("Jesus wept.")).toBe("Jesus wept.")
  })

  it("only removes a trailing suffix", () => {
    expect(
      stripEsvShortCopyright(
        "[32] Behold, the hour is coming, [33] I have said these things to you. (ESV)",
      ),
    ).toBe("[32] Behold, the hour is coming, [33] I have said these things to you.")
  })
})
