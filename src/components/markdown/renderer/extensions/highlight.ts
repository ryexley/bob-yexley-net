import {
  type Token,
  type TokenizerAndRendererExtension,
  type Tokens,
} from "marked"

type HighlightToken = Tokens.Generic & {
  type: "highlight"
  text: string
  tokens: Token[]
}

const highlightPattern = /^==(?=\S)([\s\S]*?\S)==(?!\=)/

export const highlightExtension: TokenizerAndRendererExtension<string, string> = {
  name: "highlight",
  level: "inline",
  start(src) {
    const index = src.indexOf("==")
    return index >= 0 ? index : undefined
  },
  tokenizer(src) {
    const match = highlightPattern.exec(src)
    if (!match) {
      return
    }

    const text = match[1]

    return {
      type: "highlight",
      raw: match[0],
      text,
      tokens: this.lexer.inlineTokens(text),
    }
  },
  renderer(token) {
    const highlight = token as HighlightToken
    return `<mark class="highlight">${this.parser.parseInline(highlight.tokens)}</mark>`
  },
}
