import { parseMediaEmbedBlock } from "@/components/markdown/media/media-embed-syntax"

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

function tryMediaEmbedFromCombinedText(combined: string): string | null {
  const trimmed = combined.trim()
  return parseMediaEmbedBlock(trimmed) ? trimmed : null
}

const handleMediaEmbed = function (node: any, _: any, context: any, info: any) {
  const exit = context.enter("mediaEmbed")
  const tracker = context.createTracker(info)
  const value = tracker.move(String(node.value ?? ""))
  exit()
  return value
}

export const mediaEmbedToMarkdown = {
  handlers: { mediaEmbed: handleMediaEmbed },
}

export function transformMediaEmbedParagraphs(root: MarkdownNode) {
  const visit = (parent: MarkdownParent | undefined) => {
    if (!parent?.children) {
      return
    }
    for (let index = 0; index < parent.children.length; index += 1) {
      const node = parent.children[index]
      const paragraphValue = paragraphText(node)
      if (paragraphValue) {
        const singleBlock = tryMediaEmbedFromCombinedText(paragraphValue)
        if (singleBlock) {
          parent.children[index] = {
            type: "mediaEmbed",
            value: singleBlock,
          }
          continue
        }
      }
      const merged = tryMergeParagraphSequence(parent, index)
      if (merged) {
        parent.children.splice(index, merged.length, {
          type: "mediaEmbed",
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
    const mediaValue = tryMediaEmbedFromCombinedText(combined)
    if (mediaValue) {
      return {
        length: index - startIndex + 1,
        value: mediaValue,
      }
    }
  }
  return null
}
