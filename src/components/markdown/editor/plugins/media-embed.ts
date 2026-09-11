import { $nodeAttr, $nodeSchema, $remark, $view } from "@milkdown/utils"
import {
  canonicalizeMediaEmbed,
  coerceMediaEmbedProps,
  MEDIA_EMBED_EDITOR_ATTR_DEFAULTS,
  MEDIA_EMBED_NODE,
  mediaEmbedDataAttributes,
  mediaEmbedEditorAttrsFromElement,
  mediaEmbedEditorAttrsFromUnknown,
  parseMediaEmbedEditorAttrs,
} from "@/components/markdown/media/media-embed-syntax"
import {
  mediaEmbedToMarkdown,
  transformMediaEmbedParagraphs,
} from "./media-embed-markdown"
import {
  insertMediaEmbedCommand,
  mediaEmbedKeymap,
  mediaEmbedRemovedPlugin,
  mediaEmbedTrailingParagraphPlugin,
} from "./media-embed-editor-behavior"
import { createMediaEmbedNodeView } from "./media-embed-node-view"

export const mediaEmbedAttr = $nodeAttr("mediaEmbed", () => ({
  class: "media-embed",
}))

export const mediaEmbedSchema = $nodeSchema(MEDIA_EMBED_NODE, ctx => ({
  atom: true,
  group: "block",
  draggable: true,
  selectable: true,
  isolating: true,
  attrs: {
    key: { default: MEDIA_EMBED_EDITOR_ATTR_DEFAULTS.key },
    mediaType: { default: MEDIA_EMBED_EDITOR_ATTR_DEFAULTS.mediaType },
    mimeType: { default: MEDIA_EMBED_EDITOR_ATTR_DEFAULTS.mimeType },
    size: { default: MEDIA_EMBED_EDITOR_ATTR_DEFAULTS.size },
    align: { default: MEDIA_EMBED_EDITOR_ATTR_DEFAULTS.align },
    lightbox: { default: MEDIA_EMBED_EDITOR_ATTR_DEFAULTS.lightbox },
  },
  parseDOM: [
    {
      tag: "div[data-media-embed]",
      getAttrs: dom => {
        if (!(dom instanceof HTMLElement)) {
          return false
        }
        return mediaEmbedEditorAttrsFromElement(dom)
      },
    },
  ],
  toDOM: node => {
    const attr = ctx.get(mediaEmbedAttr.key)(node)
    return [
      "div",
      {
        ...attr,
        ...mediaEmbedDataAttributes(
          mediaEmbedEditorAttrsFromUnknown(node.attrs),
        ),
      },
    ]
  },
  parseMarkdown: {
    match: ({ type }) => type === "mediaEmbed",
    runner: (state, node, type) => {
      const value = String(node.value ?? "")
      const attrs =
        parseMediaEmbedEditorAttrs(value) ?? MEDIA_EMBED_EDITOR_ATTR_DEFAULTS
      state.addNode(type, attrs)
    },
  },
  toMarkdown: {
    match: node => node.type.name === MEDIA_EMBED_NODE,
    runner: (state, node) => {
      const props = coerceMediaEmbedProps(node.attrs) ?? {
        key: String(node.attrs.key ?? ""),
        type: "image",
      }
      state.addNode("mediaEmbed", undefined, canonicalizeMediaEmbed(props))
    },
  },
}))

export const mediaEmbedView = $view(mediaEmbedSchema.node, () => {
  return (node, view, getPos) => createMediaEmbedNodeView(node, view, getPos)
})

export const remarkMediaEmbedTransform = $remark(
  "remarkMediaEmbedTransform",
  () => {
    return () => tree => {
      transformMediaEmbedParagraphs(tree)
    }
  },
)

export const remarkMediaEmbedSerializer = $remark(
  "remarkMediaEmbedSerializer",
  () => {
    return function (this: {
      data: () => {
        toMarkdownExtensions?: unknown[]
      }
    }) {
      const data = this.data()
      data.toMarkdownExtensions = [
        ...(data.toMarkdownExtensions ?? []),
        mediaEmbedToMarkdown,
      ]
    }
  },
)

export const mediaEmbed = [
  mediaEmbedAttr,
  mediaEmbedSchema,
  mediaEmbedView,
  insertMediaEmbedCommand,
  mediaEmbedKeymap,
  mediaEmbedRemovedPlugin,
  mediaEmbedTrailingParagraphPlugin,
  remarkMediaEmbedTransform,
  remarkMediaEmbedSerializer,
].flat()
