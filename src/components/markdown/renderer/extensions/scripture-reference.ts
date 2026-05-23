import {
  type TokenizerAndRendererExtension,
  type Tokens,
} from "marked"
import { normalizeReference } from "@/lib/bible/normalize-reference"
import { parseReference, type ParsedReference } from "@/lib/bible/parse-reference"

export const SCRIPTURE_REGEX =
  /\b(?:(?:1|2|3|I|II|III)\s*)?(?:Genesis|Gen|Exodus|Exod?|Ex|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut?|Joshua|Josh?|Judges|Judg?|Ruth|(?:1|2|I|II)\s*Samuel|(?:1|2|I|II)\s*Sam|(?:1|2|I|II)\s*Kings?|(?:1|2|I|II)\s*Kgs?|(?:1|2|I|II)\s*Chronicles|(?:1|2|I|II)\s*Chron?|Ezra|Nehemiah|Neh|Esther|Esth?|Job|Psalms?|Psa?|Proverbs?|Prov?|Ecclesiastes|Eccles?|Ecc|Song\s+of\s+Solomon|Song\s+of\s+Songs?|Songs?|SOS|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek?|Daniel|Dan|Hosea|Hos|Joel|Amos|Obadiah|Obad?|Jonah|Jon|Micah|Mic|Nahum|Nah|Habakkuk|Hab|Zephaniah|Zeph?|Haggai|Hag|Zechariah|Zech?|Malachi|Mal|Matthew|Matt?|Mark|Luke|John|Acts?|Romans|Rom|(?:1|2|I|II)\s*Corinthians|(?:1|2|I|II)\s*Cor|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|(?:1|2|I|II)\s*Thessalonians|(?:1|2|I|II)\s*Thess?|(?:1|2|I|II)\s*Timothy|(?:1|2|I|II)\s*Tim|Titus|Tit|Philemon|Philem?|Phlm|Hebrews|Heb|James|Jas|(?:1|2|I|II)\s*Peter|(?:1|2|I|II)\s*Pet?|(?:1|2|3|I|II|III)\s*John|(?:1|2|3|I|II|III)\s*Jn|Jude|Revelation|Rev)\s+(?:\d+:)?\d+(?:[:\-]\d+)*\b/gi

type ScriptureToken = Tokens.Generic & {
  type: "scripture"
  raw: string
  displayText: string
  parsed: ParsedReference
  normalized: string
}

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

export const scriptureReferenceExtension: TokenizerAndRendererExtension<
  string,
  string
> = {
  name: "scripture",
  level: "inline",
  start(src) {
    const index = src.search(SCRIPTURE_REGEX)
    SCRIPTURE_REGEX.lastIndex = 0
    return index >= 0 ? index : undefined
  },
  tokenizer(src) {
    SCRIPTURE_REGEX.lastIndex = 0
    const match = SCRIPTURE_REGEX.exec(src)
    if (!match || match.index !== 0) {
      return
    }

    const parsed = parseReference(match[0])
    if (!parsed) {
      return
    }

    return {
      type: "scripture",
      raw: match[0],
      displayText: match[0],
      parsed,
      normalized: normalizeReference(parsed),
    }
  },
  renderer(token) {
    const scriptureToken = token as ScriptureToken
    const { book, chapter, startVerse, endVerse } = scriptureToken.parsed
    const endVerseAttribute =
      endVerse !== null ? ` data-end-verse="${endVerse}"` : ""

    return `<span class="scripture-reference" data-book="${escapeAttribute(book)}" data-chapter="${chapter}" data-start-verse="${startVerse}"${endVerseAttribute} data-normalized="${escapeAttribute(scriptureToken.normalized)}">${escapeAttribute(scriptureToken.displayText)}</span>`
  },
}
