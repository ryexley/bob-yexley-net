import { describe, expect, it } from "vitest"
import { Schema } from "@milkdown/prose/model"
import { EditorState, TextSelection } from "@milkdown/prose/state"
import {
  insertXEmbedFromText,
  insertXEmbedNodes,
} from "./x-embed-editor-behavior"
import { X_EMBED_NODE } from "@/components/markdown/x/x-embed-syntax"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
    [X_EMBED_NODE]: {
      group: "block",
      atom: true,
      attrs: {
        url: { default: "" },
        id: { default: "" },
        handle: { default: "" },
      },
      toDOM: () => ["div", { "data-x-embed": "" }],
    },
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

describe("insertXEmbedFromText", () => {
  it("inserts an embed for a status URL", () => {
    let state = emptyDoc()
    const inserted = insertXEmbedFromText(
      {
        state,
        dispatch: transaction => {
          state = state.apply(transaction)
        },
      } as never,
      "https://x.com/stephenthompson/status/123",
    )

    expect(inserted).toBe(true)
    expect(state.doc.child(0).type.name).toBe(X_EMBED_NODE)
    expect(state.doc.child(0).attrs.id).toBe("123")
    expect(state.doc.child(0).attrs.handle).toBe("stephenthompson")
  })

  it("leaves ordinary text alone", () => {
    const state = emptyDoc()
    expect(
      insertXEmbedFromText(
        {
          state,
          dispatch: () => {
            throw new Error("should not dispatch")
          },
        } as never,
        "hello from the sideline",
      ),
    ).toBe(false)
  })
})

describe("insertXEmbedNodes", () => {
  it("replaces an empty paragraph", () => {
    let state = emptyDoc()
    const node = schema.nodes[X_EMBED_NODE].create({
      url: "https://x.com/a/status/1",
      id: "1",
      handle: "a",
    })

    insertXEmbedNodes(
      state,
      transaction => {
        state = state.apply(transaction)
      },
      [node],
    )

    expect(state.doc.child(0).type.name).toBe(X_EMBED_NODE)
  })
})
