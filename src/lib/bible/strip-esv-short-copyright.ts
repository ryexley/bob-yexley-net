export const ESV_BIBLE_URL = "https://www.esv.org/"

const ESV_SHORT_COPYRIGHT_SUFFIX = /\s*\(ESV\)\s*$/

export function stripEsvShortCopyright(text: string): string {
  return text.replace(ESV_SHORT_COPYRIGHT_SUFFIX, "").trimEnd()
}
