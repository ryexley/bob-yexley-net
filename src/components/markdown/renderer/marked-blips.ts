import { Marked } from "marked"
import { normalizeAudioEmbedsInMarkdown } from "@/components/markdown/audio/audio-embed-syntax"
import { rendererExtensions } from "./extensions"
import { audioEmbedExtension } from "./extensions/audio-embed"
import { highlightExtension } from "./extensions/highlight"

const createBlipMarked = () => {
  const marked = new Marked()
  const renderer = new marked.Renderer()
  for (const extension of rendererExtensions) {
    extension.extendRenderer(renderer)
  }

  marked.use({
    renderer,
    extensions: [highlightExtension, audioEmbedExtension],
  })

  return marked
}

const blipMarked = createBlipMarked()

export const parseBlipMarkdown = (content: string) => {
  return blipMarked.parse(normalizeAudioEmbedsInMarkdown(content)) as string
}
