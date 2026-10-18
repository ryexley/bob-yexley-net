import { describe, expect, it } from "vitest"
import { Schema, type Node } from "@milkdown/prose/model"
import { EditorState, TextSelection } from "@milkdown/prose/state"
import {
  deleteEmptyParagraphBeforeXEmbed,
  insertXEmbedFromText,
  insertXEmbedNodes,
  leadingEmptyParagraphsBeforeXEmbedEnd,
  xEmbedHygieneTransaction,
  xStatusUrlFromClipboard,
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
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      toDOM: () => ["br"],
    },
    html: {
      inline: true,
      group: "inline",
      atom: true,
      attrs: {
        value: { default: "" },
      },
      toDOM: node => ["span", { "data-html": node.attrs.value }],
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

const paragraph = () => schema.nodes.paragraph.create()
const embed = () =>
  schema.nodes[X_EMBED_NODE].create({
    url: "https://x.com/a/status/1",
    id: "1",
    handle: "a",
  })

const stateFrom = (nodes: Node[], cursor = 1): EditorState => {
  const doc = schema.node("doc", null, nodes)
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, cursor),
  })
}

describe("insertXEmbedNodes", () => {
  it("replaces an empty paragraph", () => {
    let state = emptyDoc()
    const node = embed()

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

describe("leadingEmptyParagraphsBeforeXEmbedEnd", () => {
  it("reports the empty paragraphs sitting above an X embed", () => {
    const doc = schema.node("doc", null, [paragraph(), paragraph(), embed()])
    expect(leadingEmptyParagraphsBeforeXEmbedEnd(doc)).toBe(
      paragraph().nodeSize * 2,
    )
  })

  it("treats a hard-break-only line as empty", () => {
    const brLine = schema.node("paragraph", null, [
      schema.nodes.hard_break.create(),
    ])
    const doc = schema.node("doc", null, [brLine, embed()])
    expect(leadingEmptyParagraphsBeforeXEmbedEnd(doc)).toBe(brLine.nodeSize)
  })

  it("treats a paragraph that only holds an HTML <br> as empty", () => {
    const htmlBr = schema.node("paragraph", null, [
      schema.nodes.html.create({ value: "<br />" }),
    ])
    const doc = schema.node("doc", null, [htmlBr, embed()])
    expect(leadingEmptyParagraphsBeforeXEmbedEnd(doc)).toBe(htmlBr.nodeSize)
  })

  it("treats an iOS Apple-interchange <br> as empty", () => {
    const htmlBr = schema.node("paragraph", null, [
      schema.nodes.html.create({
        value: '<br class="Apple-interchange-newline">',
      }),
    ])
    const doc = schema.node("doc", null, [htmlBr, embed()])
    expect(leadingEmptyParagraphsBeforeXEmbedEnd(doc)).toBe(htmlBr.nodeSize)
  })

  it("leaves a leading empty paragraph that is not followed by an embed", () => {
    const doc = schema.node("doc", null, [
      paragraph(),
      schema.node("paragraph", null, schema.text("hello")),
      embed(),
    ])
    expect(leadingEmptyParagraphsBeforeXEmbedEnd(doc)).toBe(0)
  })
})

describe("xEmbedHygieneTransaction", () => {
  it("strips leading empty paragraphs and keeps a trailing one after the embed", () => {
    const state = stateFrom([paragraph(), embed()])
    const transaction = xEmbedHygieneTransaction(state)
    expect(transaction).toBeTruthy()
    const next = state.apply(transaction!)
    expect(next.doc.childCount).toBe(2)
    expect(next.doc.firstChild?.type.name).toBe(X_EMBED_NODE)
    expect(next.doc.lastChild?.type.name).toBe("paragraph")
    expect(next.doc.lastChild?.content.size).toBe(0)
  })

  it("strips a leading HTML <br> paragraph so it is not serialized", () => {
    const htmlBr = schema.node("paragraph", null, [
      schema.nodes.html.create({ value: "<br />" }),
    ])
    const state = stateFrom([htmlBr, embed()])
    const transaction = xEmbedHygieneTransaction(state)
    expect(transaction).toBeTruthy()
    const next = state.apply(transaction!)
    expect(next.doc.firstChild?.type.name).toBe(X_EMBED_NODE)
  })

  it("turns a pasted status URL paragraph into an embed and drops the blank line above it", () => {
    const urlLine = schema.node("paragraph", null, [
      schema.text("https://x.com/Vol_Football/status/2111605291062034697"),
    ])
    const state = stateFrom([paragraph(), urlLine])
    const transaction = xEmbedHygieneTransaction(state)
    expect(transaction).toBeTruthy()
    const next = state.apply(transaction!)
    expect(next.doc.firstChild?.type.name).toBe(X_EMBED_NODE)
    expect(next.doc.firstChild?.attrs.id).toBe("2111605291062034697")
    expect(next.doc.lastChild?.type.name).toBe("paragraph")
  })
})

describe("xStatusUrlFromClipboard", () => {
  const clipboard = (data: Record<string, string>): DataTransfer =>
    ({
      getData: (type: string) => data[type] ?? "",
    }) as DataTransfer

  it("reads a status URL from text/plain", () => {
    expect(
      xStatusUrlFromClipboard(
        clipboard({
          "text/plain": "https://x.com/Vol_Football/status/2111605291062034697",
        }),
      ),
    ).toBe("https://x.com/Vol_Football/status/2111605291062034697")
  })

  it("reads a status URL from iOS text/html when plain text is empty", () => {
    expect(
      xStatusUrlFromClipboard(
        clipboard({
          "text/plain": "",
          "text/html":
            '<meta charset="utf-8"><a href="https://x.com/Vol_Football/status/2111605291062034697">https://x.com/Vol_Football/status/2111605291062034697</a>',
        }),
      ),
    ).toBe("https://x.com/Vol_Football/status/2111605291062034697")
  })

  it("ignores non-status clipboard HTML", () => {
    expect(
      xStatusUrlFromClipboard(
        clipboard({
          "text/html": '<a href="https://x.com/Vol_Football">profile</a>',
        }),
      ),
    ).toBeNull()
  })
})

describe("deleteEmptyParagraphBeforeXEmbed", () => {
  it("deletes an empty paragraph immediately before an embed", () => {
    let state = stateFrom([paragraph(), embed(), paragraph()], 1)
    expect(
      deleteEmptyParagraphBeforeXEmbed(state, tr => {
        state = state.apply(tr)
      }),
    ).toBe(true)
    expect(state.doc.firstChild?.type.name).toBe(X_EMBED_NODE)
  })

  it("does not delete the trailing paragraph after an embed", () => {
    const node = embed()
    const state = stateFrom([node, paragraph()], node.nodeSize + 1)
    expect(deleteEmptyParagraphBeforeXEmbed(state)).toBe(false)
  })
})
