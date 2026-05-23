import { render, screen } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { ScripturePassagePanel } from "@/modules/blips/components/scripture-passage-panel"

describe("ScripturePassagePanel", () => {
  it("renders a skeleton while loading", () => {
    render(() => (
      <ScripturePassagePanel
        reference="Romans 8:28"
        state={{ status: "loading" }}
      />
    ))

    expect(screen.getByText("Romans 8:28")).toBeTruthy()
    expect(document.querySelector(".scripture-passage-panel-skeleton")).toBeTruthy()
  })

  it("renders loaded passage text", () => {
    render(() => (
      <ScripturePassagePanel
        reference="John 11:35"
        state={{ status: "loaded", text: "Jesus wept." }}
      />
    ))

    expect(screen.getByText("Jesus wept.")).toBeTruthy()
    expect(document.querySelector(".scripture-passage-copyright")).toBeTruthy()
  })

  it("strips the inline ESV suffix and renders a pinned copyright footer", () => {
    render(() => (
      <ScripturePassagePanel
        reference="John 11:35"
        state={{ status: "loaded", text: "Jesus wept. (ESV)" }}
      />
    ))

    expect(screen.getByText("Jesus wept.")).toBeTruthy()
    expect(screen.queryByText("(ESV)")).toBeNull()

    const link = screen.getByRole("link", { name: "ESV® Bible" })
    expect(link.getAttribute("href")).toBe("https://www.esv.org/")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("styles ESV verse markers as subdued superscript numbers", () => {
    render(() => (
      <ScripturePassagePanel
        reference="John 16:32-33"
        state={{
          status: "loaded",
          text: "[32] Behold, the hour is coming, [33] I have said these things to you. (ESV)",
        }}
      />
    ))

    const verseNumbers = document.querySelectorAll(".verse-number")
    expect(verseNumbers).toHaveLength(2)
    expect(verseNumbers[0]?.textContent).toBe("32")
    expect(verseNumbers[1]?.textContent).toBe("33")
    expect(document.querySelectorAll(".verse-start")).toHaveLength(2)
    expect(screen.getByText("Behold,")).toBeTruthy()
    expect(screen.getByText(/have said these things to you\./)).toBeTruthy()
    expect(screen.queryByText("(ESV)")).toBeNull()
    expect(document.querySelector(".scripture-passage-copyright")).toBeTruthy()
  })

  it("renders an error fallback", () => {
    render(() => (
      <ScripturePassagePanel
        reference="John 11:35"
        state={{ status: "error" }}
      />
    ))

    expect(screen.getByText("Passage unavailable")).toBeTruthy()
  })
})
