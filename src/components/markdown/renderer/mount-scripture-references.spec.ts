import { describe, expect, it } from "vitest"
import {
  mountMarkdownScriptureReferences,
  readScriptureReferenceMountProps,
} from "@/components/markdown/renderer/mount-scripture-references"

describe("readScriptureReferenceMountProps", () => {
  it("reads structured scripture data attributes from a rendered span", () => {
    const node = document.createElement("span")
    node.className = "scripture-reference"
    node.dataset.book = "Romans"
    node.dataset.chapter = "8"
    node.dataset.startVerse = "28"
    node.dataset.endVerse = "30"
    node.dataset.normalized = "Romans 8:28-30"
    node.textContent = "Romans 8:28-30"

    expect(readScriptureReferenceMountProps(node)).toEqual({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: 30,
      normalized: "Romans 8:28-30",
      displayText: "Romans 8:28-30",
    })
  })

  it("returns null for incomplete scripture spans", () => {
    const node = document.createElement("span")
    node.className = "scripture-reference"
    node.dataset.book = "Romans"

    expect(readScriptureReferenceMountProps(node)).toBeNull()
  })

  it("clears rendered text before mounting the interactive component", () => {
    const container = document.createElement("div")
    const node = document.createElement("span")
    node.className = "scripture-reference"
    node.dataset.book = "John"
    node.dataset.chapter = "16"
    node.dataset.startVerse = "32"
    node.dataset.endVerse = "33"
    node.dataset.normalized = "John 16:32-33"
    node.textContent = "John 16:32-33"
    container.append(node)

    mountMarkdownScriptureReferences(container, (_props, target) => {
      expect(target.textContent).toBe("")
      target.textContent = "John 16:32-33"

      return () => {
        target.textContent = ""
      }
    })
  })
})
