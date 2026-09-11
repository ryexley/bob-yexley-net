import { type TokenizerAndRendererExtension, type Tokens } from "marked"
import { parseLeadingMediaEmbed } from "@/components/markdown/media/media-embed-syntax"

type MediaEmbedToken = Tokens.Generic & {
  type: "mediaEmbed"
  raw: string
  propsJson: string
}

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

export const mediaEmbedExtension: TokenizerAndRendererExtension<
  string,
  string
> = {
  name: "mediaEmbed",
  level: "block",
  start(src) {
    const index = src.search(/\{\s*media\s*:\s*\{/)
    return index >= 0 ? index : undefined
  },
  tokenizer(src) {
    const parsed = parseLeadingMediaEmbed(src)
    if (!parsed) {
      return
    }
    return {
      type: "mediaEmbed",
      raw: parsed.raw,
      propsJson: JSON.stringify(parsed.props),
    }
  },
  renderer(token) {
    const mediaToken = token as MediaEmbedToken
    const encoded = encodeURIComponent(mediaToken.propsJson)
    return `<div class="media-embed-mount" data-media-embed-props="${escapeAttribute(encoded)}"></div>`
  },
}
