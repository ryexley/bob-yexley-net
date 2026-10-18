import { $nodeAttr, $nodeSchema, $remark, $view } from "@milkdown/utils"
import {
  canonicalizeXEmbed,
  parseXEmbedEditorAttrs,
  xEmbedDataAttributes,
  xEmbedEditorAttrsFromUnknown,
  X_EMBED_NODE,
} from "@/components/markdown/x/x-embed-syntax"
import { transformXEmbedParagraphs, xEmbedToMarkdown } from "./x-embed-markdown"
import {
  insertXEmbedCommand,
  xEmbedClipboardPlugin,
  xEmbedKeymap,
  xEmbedTrailingParagraphPlugin,
} from "./x-embed-editor-behavior"
import { createXEmbedNodeView } from "./x-embed-node-view"

export const xEmbedAttr = $nodeAttr("xEmbed", () => ({
  class: "x-embed",
}))

export const xEmbedSchema = $nodeSchema(X_EMBED_NODE, ctx => ({
  atom: true,
  group: "block",
  draggable: true,
  selectable: true,
  isolating: true,
  attrs: {
    url: { default: "" },
    id: { default: "" },
    handle: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-x-embed]",
      getAttrs: dom => {
        if (!(dom instanceof HTMLElement)) {
          return false
        }
        const attrs = xEmbedEditorAttrsFromUnknown({
          url: dom.getAttribute("data-x-url"),
          id: dom.getAttribute("data-x-status-id"),
          handle: dom.getAttribute("data-x-handle"),
        })
        return attrs.id ? attrs : false
      },
    },
  ],
  toDOM: node => {
    const attr = ctx.get(xEmbedAttr.key)(node)
    const props = xEmbedEditorAttrsFromUnknown(node.attrs)
    return [
      "div",
      {
        ...attr,
        ...xEmbedDataAttributes(props),
      },
    ]
  },
  parseMarkdown: {
    match: ({ type }) => type === "xEmbed",
    runner: (state, node, type) => {
      const value = String(node.value ?? "")
      const attrs = parseXEmbedEditorAttrs(value)
      if (!attrs) {
        return
      }
      state.addNode(type, attrs)
    },
  },
  toMarkdown: {
    match: node => node.type.name === X_EMBED_NODE,
    runner: (state, node) => {
      const props = xEmbedEditorAttrsFromUnknown(node.attrs)
      state.addNode("xEmbed", undefined, canonicalizeXEmbed(props))
    },
  },
}))

export const xEmbedView = $view(xEmbedSchema.node, () => {
  return (node, view, getPos) => createXEmbedNodeView(node, view, getPos)
})

export const remarkXEmbedTransform = $remark("remarkXEmbedTransform", () => {
  return () => tree => {
    transformXEmbedParagraphs(tree)
  }
})

export const remarkXEmbedSerializer = $remark("remarkXEmbedSerializer", () => {
  return function (this: {
    data: () => {
      toMarkdownExtensions?: unknown[]
    }
  }) {
    const data = this.data()
    data.toMarkdownExtensions = [
      ...(data.toMarkdownExtensions ?? []),
      xEmbedToMarkdown,
    ]
  }
})

export const xEmbed = [
  xEmbedAttr,
  xEmbedSchema,
  xEmbedView,
  insertXEmbedCommand,
  xEmbedKeymap,
  xEmbedClipboardPlugin,
  xEmbedTrailingParagraphPlugin,
  remarkXEmbedTransform,
  remarkXEmbedSerializer,
].flat()
