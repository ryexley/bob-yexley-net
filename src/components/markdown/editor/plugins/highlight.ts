import { toggleMark } from "@milkdown/prose/commands"
import { markRule } from "@milkdown/prose"
import { $command, $inputRule, $markAttr, $markSchema, $remark } from "@milkdown/utils"
import { pandocMark } from "micromark-extension-mark/index.js"
import {
  highlightFromMarkdown,
  highlightToMarkdown,
} from "./highlight-markdown"

const highlightInputPattern = /(?:^|[^=])==([^=\s](?:.*?[^=\s])?)==$/

export const highlightAttr = $markAttr("highlight")

export const highlightSchema = $markSchema("highlight", ctx => ({
  parseDOM: [{ tag: "mark" }],
  toDOM: mark => ["mark", { ...ctx.get(highlightAttr.key)(mark), class: "highlight" }],
  parseMarkdown: {
    match: node => node.type === "mark",
    runner: (state, node, markType) => {
      state.openMark(markType)
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: mark => mark.type.name === "highlight",
    runner: (state, mark) => {
      state.withMark(mark, "mark")
    },
  },
}))

export const toggleHighlightCommand = $command("ToggleHighlight", ctx => () => {
  return toggleMark(highlightSchema.type(ctx))
})

export const highlightInputRule = $inputRule(ctx => {
  return markRule(highlightInputPattern, highlightSchema.type(ctx), {
    updateCaptured: ({ fullMatch, start }) =>
      !fullMatch.startsWith("==")
        ? { fullMatch: fullMatch.slice(1), start: start + 1 }
        : {},
  })
})

export const remarkHighlight = $remark("remarkHighlight", () => {
  return function (this: {
    data: () => {
      micromarkExtensions?: unknown[]
      fromMarkdownExtensions?: unknown[]
      toMarkdownExtensions?: unknown[]
    }
  }) {
    const data = this.data() as {
      micromarkExtensions?: unknown[]
      fromMarkdownExtensions?: unknown[]
      toMarkdownExtensions?: unknown[]
    }

    data.micromarkExtensions = [...(data.micromarkExtensions ?? []), pandocMark()]
    data.fromMarkdownExtensions = [
      ...(data.fromMarkdownExtensions ?? []),
      highlightFromMarkdown,
    ]
    data.toMarkdownExtensions = [
      ...(data.toMarkdownExtensions ?? []),
      highlightToMarkdown,
    ]
  }
})

export const highlight = [
  highlightAttr,
  highlightSchema,
  toggleHighlightCommand,
  highlightInputRule,
  remarkHighlight,
].flat()
