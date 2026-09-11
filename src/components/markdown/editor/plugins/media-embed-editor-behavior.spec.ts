import { describe, expect, it } from "vitest"
import { Schema, type Node } from "@milkdown/prose/model"
import { EditorState, TextSelection } from "@milkdown/prose/state"
import {
  deleteEmptyParagraphBeforeMedia,
  insertMediaEmbedNodes,
  leadingEmptyParagraphsBeforeMediaEnd,
  mediaEmbedHygieneTransaction,
} from "./media-embed-editor-behavior"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
    media_embed: {
      group: "block",
      atom: true,
      isolating: true,
      attrs: {
        key: { default: "" },
        mediaType: { default: "image" },
        mimeType: { default: "" },
      },
      toDOM: () => ["div", { "data-media-embed": "" }],
    },
  },
})

const paragraph = () => schema.nodes.paragraph.create()
const media = () =>
  schema.nodes.media_embed.create({
    key: "media/u/b/a",
    mediaType: "gif",
    mimeType: "image/gif",
  })

const stateFrom = (nodes: Node[], cursor = 1): EditorState => {
  const doc = schema.node("doc", null, nodes)
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, cursor),
  })
}

describe("leadingEmptyParagraphsBeforeMediaEnd", () => {
  it("reports the empty paragraphs sitting above a media embed", () => {
    const doc = schema.node("doc", null, [paragraph(), paragraph(), media()])
    expect(leadingEmptyParagraphsBeforeMediaEnd(doc)).toBe(
      paragraph().nodeSize * 2,
    )
  })

  it("leaves a leading empty paragraph that is not followed by media", () => {
    const doc = schema.node("doc", null, [
      paragraph(),
      schema.node("paragraph", null, schema.text("hello")),
      media(),
    ])
    expect(leadingEmptyParagraphsBeforeMediaEnd(doc)).toBe(0)
  })
})

describe("insertMediaEmbedNodes", () => {
  it("replaces an empty paragraph instead of leaving it above the embed", () => {
    let state = stateFrom([paragraph()])
    insertMediaEmbedNodes(
      state,
      tr => {
        state = state.apply(tr)
      },
      [media()],
    )

    expect(state.doc.firstChild?.type.name).toBe("media_embed")
    expect(state.doc.childCount).toBe(1)
  })
})

describe("mediaEmbedHygieneTransaction", () => {
  it("strips leading empty paragraphs and keeps a trailing one after media", () => {
    const state = stateFrom([paragraph(), media()])
    const transaction = mediaEmbedHygieneTransaction(state)
    expect(transaction).toBeTruthy()
    const next = state.apply(transaction!)
    expect(next.doc.childCount).toBe(2)
    expect(next.doc.firstChild?.type.name).toBe("media_embed")
    expect(next.doc.lastChild?.type.name).toBe("paragraph")
    expect(next.doc.lastChild?.content.size).toBe(0)
  })
})

describe("deleteEmptyParagraphBeforeMedia", () => {
  it("deletes an empty paragraph immediately before an embed", () => {
    let state = stateFrom([paragraph(), media(), paragraph()], 1)
    expect(
      deleteEmptyParagraphBeforeMedia(state, tr => {
        state = state.apply(tr)
      }),
    ).toBe(true)
    expect(state.doc.firstChild?.type.name).toBe("media_embed")
  })

  it("does not delete the trailing paragraph after an embed", () => {
    const embed = media()
    const state = stateFrom([embed, paragraph()], embed.nodeSize + 1)
    expect(deleteEmptyParagraphBeforeMedia(state)).toBe(false)
  })
})
