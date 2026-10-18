import {
  canonicalizeXEmbed,
  parseXEmbedBlock,
  parseXStatusUrl,
} from "@/components/markdown/x/x-embed-syntax"

type MarkdownParent = {
  children?: MarkdownNode[]
}

type MarkdownNode = {
  type?: string
  children?: MarkdownNode[]
  value?: string
}

function paragraphText(node: MarkdownNode): string | null {
  if (node.type !== "paragraph" || !Array.isArray(node.children)) {
    return null
  }
  if (node.children.length !== 1 || node.children[0]?.type !== "text") {
    return null
  }
  const value = node.children[0]?.value
  return typeof value === "string" ? value : null
}

function tryXEmbedFromCombinedText(combined: string): string | null {
  const trimmed = combined.trim()
  const fromShorthand = parseXEmbedBlock(trimmed)
  if (fromShorthand) {
    return canonicalizeXEmbed(fromShorthand)
  }
  const fromUrl = parseXStatusUrl(trimmed)
  return fromUrl ? canonicalizeXEmbed(fromUrl) : null
}

const handleXEmbed = function (node: any, _: any, context: any, info: any) {
  const exit = context.enter("xEmbed")
  const tracker = context.createTracker(info)
  const value = tracker.move(String(node.value ?? ""))
  exit()
  return value
}

export const xEmbedToMarkdown = {
  handlers: { xEmbed: handleXEmbed },
}

export function transformXEmbedParagraphs(root: MarkdownNode) {
  const visit = (parent: MarkdownParent | undefined) => {
    if (!parent?.children) {
      return
    }
    for (let index = 0; index < parent.children.length; index += 1) {
      const node = parent.children[index]
      const paragraphValue = paragraphText(node)
      if (paragraphValue) {
        const singleBlock = tryXEmbedFromCombinedText(paragraphValue)
        if (singleBlock) {
          parent.children[index] = {
            type: "xEmbed",
            value: singleBlock,
          }
          continue
        }
      }
      const merged = tryMergeParagraphSequence(parent, index)
      if (merged) {
        parent.children.splice(index, merged.length, {
          type: "xEmbed",
          value: merged.value,
        })
        continue
      }
      visit(node)
    }
  }
  visit(root)
}

function tryMergeParagraphSequence(
  parent: MarkdownParent,
  startIndex: number,
): { length: number; value: string } | null {
  let combined = ""
  for (
    let index = startIndex;
    index < (parent.children?.length ?? 0);
    index += 1
  ) {
    const text = paragraphText(parent.children?.[index] ?? {})
    if (text === null) {
      break
    }
    combined = combined ? `${combined}\n\n${text}` : text
    const embedValue = tryXEmbedFromCombinedText(combined)
    if (embedValue) {
      return {
        length: index - startIndex + 1,
        value: embedValue,
      }
    }
  }
  return null
}
