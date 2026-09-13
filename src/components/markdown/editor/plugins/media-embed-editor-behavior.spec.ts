import { describe, expect, it, vi } from "vitest"
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

/**
 * Insertion is what the inline-paste path calls once the placement prompt
 * resolves. Getting the selection or the node count wrong here means a pasted
 * photo lands in the wrong place, or replaces text the author already typed.
 */
describe("insertMediaEmbedNodes — insertion positions", () => {
  const textParagraph = (text: string) =>
    schema.node("paragraph", null, schema.text(text))

  it("does nothing when there is nothing to insert", () => {
    const state = stateFrom([paragraph()])

    expect(insertMediaEmbedNodes(state, () => {}, [])).toBe(false)
  })

  it("reports it can run without dispatching, for command availability", () => {
    const state = stateFrom([paragraph()])
    const dispatch = vi.fn()

    // Milkdown probes commands with no dispatch to decide whether to enable UI.
    expect(insertMediaEmbedNodes(state, undefined, [media()])).toBe(true)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("inserts at the cursor without destroying surrounding text", () => {
    // Cursor inside "hello", which is not an empty textblock, so the embed is
    // inserted at the selection rather than replacing the paragraph.
    let state = stateFrom([textParagraph("hello")], 3)

    insertMediaEmbedNodes(
      state,
      tr => {
        state = state.apply(tr)
      },
      [media()],
    )

    const text = state.doc.textBetween(0, state.doc.content.size, "")
    expect(text).toBe("hello")
    expect(
      state.doc.content.content.some(node => node.type.name === "media_embed"),
    ).toBe(true)
  })

  it("inserts several pasted attachments in order", () => {
    let state = stateFrom([paragraph()])
    const first = schema.nodes.media_embed.create({ key: "media/u/b/one" })
    const second = schema.nodes.media_embed.create({ key: "media/u/b/two" })
    const third = schema.nodes.media_embed.create({ key: "media/u/b/three" })

    insertMediaEmbedNodes(
      state,
      tr => {
        state = state.apply(tr)
      },
      [first, second, third],
    )

    const keys = state.doc.content.content
      .filter(node => node.type.name === "media_embed")
      .map(node => node.attrs.key)
    expect(keys).toEqual(["media/u/b/one", "media/u/b/two", "media/u/b/three"])
  })

  it("moves the cursor into the textblock below the inserted media", () => {
    // The embed replaces the empty paragraph the cursor sits in; the caret then
    // has to move past it, since an atom node cannot hold a text cursor.
    // (Ensuring such a textblock exists is `mediaEmbedTrailingParagraphPlugin`'s
    // job, so one is provided here.)
    let state = stateFrom([paragraph(), textParagraph("after")], 1)

    insertMediaEmbedNodes(
      state,
      tr => {
        state = state.apply(tr)
      },
      [media()],
    )

    expect(state.doc.firstChild?.type.name).toBe("media_embed")
    expect(state.selection.$from.parent.isTextblock).toBe(true)
    expect(state.selection.$from.parent.textContent).toBe("after")
  })
})

describe("deleteEmptyParagraphBeforeMedia — guards", () => {
  it("does nothing when the selection is not empty", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("hello")),
      media(),
    ])
    const state = EditorState.create({
      schema,
      doc,
      selection: TextSelection.create(doc, 1, 4),
    })

    expect(deleteEmptyParagraphBeforeMedia(state)).toBe(false)
  })

  it("does nothing in a paragraph that still has text", () => {
    const state = stateFrom(
      [schema.node("paragraph", null, schema.text("hello")), media()],
      3,
    )

    expect(deleteEmptyParagraphBeforeMedia(state)).toBe(false)
  })

  it("does nothing when the next node is not media", () => {
    const state = stateFrom([paragraph(), paragraph()], 1)

    expect(deleteEmptyParagraphBeforeMedia(state)).toBe(false)
  })

  it("reports it can run without dispatching", () => {
    const state = stateFrom([paragraph(), media()], 1)

    expect(deleteEmptyParagraphBeforeMedia(state)).toBe(true)
  })
})
