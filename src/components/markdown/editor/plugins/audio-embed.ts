import { $nodeAttr, $nodeSchema, $remark } from "@milkdown/utils"
import { canonicalizeAudioEmbedBlock, extractAudioEmbedBlock } from "@/components/markdown/audio/audio-embed-syntax"
import {
  audioEmbedToMarkdown,
  transformAudioEmbedParagraphs,
} from "./audio-embed-markdown"
import {
  arrowDownFromAudioEmbedCommand,
  audioEmbedGapCursorPlugin,
  audioEmbedKeymap,
  audioEmbedTrailingParagraphPlugin,
  exitAudioEmbedCommand,
} from "./audio-embed-editor-behavior"

export const audioEmbedAttr = $nodeAttr("audioEmbed", () => ({
  pre: { class: "audio-embed-block" },
  code: {},
}))

export const audioEmbedSchema = $nodeSchema("audio_embed", ctx => ({
  content: "text*",
  group: "block",
  marks: "",
  defining: true,
  code: true,
  parseDOM: [
    {
      tag: "pre[data-audio-embed]",
      preserveWhitespace: "full",
    },
  ],
  toDOM: node => {
    const attr = ctx.get(audioEmbedAttr.key)(node)
    return [
      "pre",
      { ...attr.pre, "data-audio-embed": "" },
      ["code", attr.code, 0],
    ]
  },
  parseMarkdown: {
    match: ({ type }) => type === "audioEmbed",
    runner: (state, node, type) => {
      const value = node.value as string | null
      state.openNode(type)
      if (value) {
        state.addText(value)
      }
      state.closeNode()
    },
  },
  toMarkdown: {
    match: node => node.type.name === "audio_embed",
    runner: (state, node) => {
      const text = node.textContent
      const block = extractAudioEmbedBlock(text)
      const value = block ? canonicalizeAudioEmbedBlock(block) : text
      state.addNode("audioEmbed", undefined, value)
    },
  },
}))

export const remarkAudioEmbedTransform = $remark("remarkAudioEmbedTransform", () => {
  return () => tree => {
    transformAudioEmbedParagraphs(tree)
  }
})

export const remarkAudioEmbedSerializer = $remark(
  "remarkAudioEmbedSerializer",
  () => {
    return function (this: {
      data: () => {
        toMarkdownExtensions?: unknown[]
      }
    }) {
      const data = this.data()
      data.toMarkdownExtensions = [
        ...(data.toMarkdownExtensions ?? []),
        audioEmbedToMarkdown,
      ]
    }
  },
)

export const audioEmbed = [
  audioEmbedAttr,
  audioEmbedSchema,
  exitAudioEmbedCommand,
  arrowDownFromAudioEmbedCommand,
  audioEmbedKeymap,
  audioEmbedGapCursorPlugin,
  audioEmbedTrailingParagraphPlugin,
  remarkAudioEmbedTransform,
  remarkAudioEmbedSerializer,
].flat()
