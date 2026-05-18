import {
  type TokenizerAndRendererExtension,
  type Tokens,
} from "marked"
import {
  extractAudioEmbedBlock,
  parseAudioEmbedBlock,
} from "@/components/markdown/audio/audio-embed-syntax"

type AudioEmbedToken = Tokens.Generic & {
  type: "audioEmbed"
  raw: string
  propsJson: string
}

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

export const audioEmbedExtension: TokenizerAndRendererExtension<
  string,
  string
> = {
  name: "audioEmbed",
  level: "block",
  start(src) {
    const index = src.search(/\{\s*audio\s*:\s*\{/)
    return index >= 0 ? index : undefined
  },
  tokenizer(src) {
    const block = extractAudioEmbedBlock(src)
    if (!block) {
      return
    }

    const props = parseAudioEmbedBlock(block.raw)
    if (!props) {
      return
    }

    return {
      type: "audioEmbed",
      raw: block.raw,
      propsJson: JSON.stringify(props),
    }
  },
  renderer(token) {
    const audioToken = token as AudioEmbedToken
    const encoded = encodeURIComponent(audioToken.propsJson)

    return `<div class="blip-audio-player" data-audio-player-props="${escapeAttribute(encoded)}"></div>`
  },
}
