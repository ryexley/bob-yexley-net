import { Marked } from "marked"
import { rendererExtensions } from "./extensions"
import { highlightExtension } from "./extensions/highlight"

const createBlipMarked = () => {
  const marked = new Marked()
  const renderer = new marked.Renderer()
  for (const extension of rendererExtensions) {
    extension.extendRenderer(renderer)
  }

  marked.use({ renderer, extensions: [highlightExtension] })

  return marked
}

const blipMarked = createBlipMarked()

export const parseBlipMarkdown = (content: string) => {
  return blipMarked.parse(content) as string
}
