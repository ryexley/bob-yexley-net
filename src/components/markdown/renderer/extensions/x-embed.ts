import { type TokenizerAndRendererExtension, type Tokens } from "marked"
import {
  parseLeadingXEmbed,
  parseLeadingXStatusUrl,
} from "@/components/markdown/x/x-embed-syntax"

type XEmbedToken = Tokens.Generic & {
  type: "xEmbed"
  raw: string
  propsJson: string
}

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

export const xEmbedExtension: TokenizerAndRendererExtension<string, string> = {
  name: "xEmbed",
  level: "block",
  start(src) {
    const embedIndex = src.search(/\{\s*x\s*:\s*\{/)
    const urlMatch = src.match(/^(?:\s*\n)*[ \t]*(https?:\/\/\S+)/)
    const urlIndex =
      urlMatch?.[1] && parseLeadingXStatusUrl(src)
        ? src.indexOf(urlMatch[1])
        : -1

    if (embedIndex < 0 && urlIndex < 0) {
      return undefined
    }
    if (embedIndex < 0) {
      return urlIndex
    }
    if (urlIndex < 0) {
      return embedIndex
    }
    return Math.min(embedIndex, urlIndex)
  },
  tokenizer(src) {
    const block = parseLeadingXEmbed(src) ?? parseLeadingXStatusUrl(src)
    if (!block) {
      return
    }
    return {
      type: "xEmbed",
      raw: block.raw,
      propsJson: JSON.stringify(block.props),
    }
  },
  renderer(token) {
    const xToken = token as XEmbedToken
    const encoded = encodeURIComponent(xToken.propsJson)
    return `<div class="x-embed-mount" data-x-embed-props="${escapeAttribute(encoded)}"></div>`
  },
}
