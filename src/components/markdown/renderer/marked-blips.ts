import { Marked } from "marked"
import { normalizeAudioEmbedsInMarkdown } from "@/components/markdown/audio/audio-embed-syntax"
import { normalizeMediaEmbedsInMarkdown } from "@/components/markdown/media/media-embed-syntax"
import { rendererExtensions } from "./extensions"
import { audioEmbedExtension } from "./extensions/audio-embed"
import { mediaEmbedExtension } from "./extensions/media-embed"
import { highlightExtension } from "./extensions/highlight"
import { scriptureReferenceExtension } from "./extensions/scripture-reference"

const createBlipMarked = () => {
  const marked = new Marked()
  const renderer = new marked.Renderer()
  for (const extension of rendererExtensions) {
    extension.extendRenderer(renderer)
  }

  marked.use({
    renderer,
    extensions: [
      highlightExtension,
      audioEmbedExtension,
      mediaEmbedExtension,
      scriptureReferenceExtension,
    ],
  })

  return marked
}

const blipMarked = createBlipMarked()

export const parseBlipMarkdown = (content: string) => {
  return blipMarked.parse(
    normalizeMediaEmbedsInMarkdown(normalizeAudioEmbedsInMarkdown(content)),
  ) as string
}
