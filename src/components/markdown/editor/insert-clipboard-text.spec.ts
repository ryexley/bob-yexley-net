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

/**
 * The text half of the paste path: when a paste carries no media, this puts the
 * plain text in without letting ProseMirror's HTML parser near it (iOS supplies
 * markup that would otherwise arrive as styled spans).
 */
describe("applyClipboardText — edge cases", () => {
  it("does nothing for empty text", () => {
    const state = emptyDoc()

    expect(applyClipboardText(state, () => {}, "")).toBe(false)
  })

  it("reports it can run without dispatching", () => {
    const state = emptyDoc()

    expect(applyClipboardText(state, undefined, "hello")).toBe(true)
  })

  it("normalizes CRLF so Windows text does not double-space", () => {
    let state = emptyDoc()

    applyClipboardText(
      state,
      tr => {
        state = state.apply(tr)
      },
      "one\r\ntwo",
    )

    expect(state.doc.childCount).toBe(2)
    expect(state.doc.firstChild?.textContent).toBe("one")
    expect(state.doc.lastChild?.textContent).toBe("two")
  })

  it("keeps a blank line as an empty paragraph", () => {
    let state = emptyDoc()

    applyClipboardText(
      state,
      tr => {
        state = state.apply(tr)
      },
      "one\n\ntwo",
    )

    expect(state.doc.childCount).toBe(3)
    expect(state.doc.child(1).content.size).toBe(0)
  })

  it("falls back to spaces when the schema has no paragraph node", () => {
    // A schema without `paragraph` cannot hold multi-block text, so newlines
    // collapse rather than throwing.
    const inlineSchema = new Schema({
      nodes: {
        doc: { content: "block+" },
        block: { group: "block", content: "inline*", toDOM: () => ["div", 0] },
        text: { group: "inline" },
      },
    })
    const block = inlineSchema.nodes.block.create()
    const doc = inlineSchema.node("doc", null, [block])
    let state = EditorState.create({
      schema: inlineSchema,
      doc,
      selection: TextSelection.create(doc, 1),
    })

    expect(
      applyClipboardText(
        state,
        tr => {
          state = state.apply(tr)
        },
        "one\ntwo",
      ),
    ).toBe(true)
    expect(state.doc.textContent).toBe("one two")
  })
})
