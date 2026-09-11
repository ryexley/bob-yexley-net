import { describe, expect, it } from "vitest"
import { Schema } from "@milkdown/prose/model"
import { EditorState, TextSelection } from "@milkdown/prose/state"
import { applyClipboardText } from "./insert-clipboard-text"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
  },
})

const emptyDoc = () => {
  const paragraph = schema.nodes.paragraph.create()
  const doc = schema.node("doc", null, [paragraph])
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 1),
  })
}

describe("applyClipboardText", () => {
  it("inserts a single line at the caret", () => {
    let state = emptyDoc()
    applyClipboardText(
      state,
      tr => {
        state = state.apply(tr)
      },
      "hello",
    )
    expect(state.doc.textContent).toBe("hello")
  })

  it("turns newlines into paragraphs", () => {
    let state = emptyDoc()
    applyClipboardText(
      state,
      tr => {
        state = state.apply(tr)
      },
      "one\ntwo",
    )
    expect(state.doc.childCount).toBe(2)
    expect(state.doc.child(0).textContent).toBe("one")
    expect(state.doc.child(1).textContent).toBe("two")
  })
})
