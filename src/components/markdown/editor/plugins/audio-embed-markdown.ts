import {
  extractAudioEmbedBlock,
  parseAudioEmbedBlock,
} from "@/components/markdown/audio/audio-embed-syntax"

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

function tryAudioEmbedFromCombinedText(combined: string): string | null {
  const block = extractAudioEmbedBlock(combined.trim())
  if (!block || !parseAudioEmbedBlock(block.raw)) {
    return null
  }

  return block.raw
}

const enterAudioEmbed = function (this: any, token: any) {
  this.enter({ type: "audioEmbed", value: token.value }, token)
}

const exitAudioEmbed = function (this: any, token: any) {
  this.exit(token)
}

const handleAudioEmbed = function (node: any, _: any, context: any, info: any) {
  const exit = context.enter("audioEmbed")
  const tracker = context.createTracker(info)
  const value = tracker.move(String(node.value ?? ""))
  exit()
  return value
}

export const audioEmbedFromMarkdown = {
  enter: { audioEmbed: enterAudioEmbed },
  exit: { audioEmbed: exitAudioEmbed },
}

export const audioEmbedToMarkdown = {
  handlers: { audioEmbed: handleAudioEmbed },
}

export function transformAudioEmbedParagraphs(root: MarkdownNode) {
  const visit = (parent: MarkdownParent | undefined) => {
    if (!parent?.children) {
      return
    }

    for (let index = 0; index < parent.children.length; index += 1) {
      const node = parent.children[index]
      const paragraphValue = paragraphText(node)
      if (paragraphValue) {
        const singleBlock = tryAudioEmbedFromCombinedText(paragraphValue)
        if (singleBlock) {
          parent.children[index] = {
            type: "audioEmbed",
            value: singleBlock,
          }
          continue
        }
      }

      const merged = tryMergeParagraphSequence(parent, index)
      if (merged) {
        parent.children.splice(index, merged.length, {
          type: "audioEmbed",
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

  for (let index = startIndex; index < (parent.children?.length ?? 0); index += 1) {
    const text = paragraphText(parent.children?.[index] ?? {})
    if (text === null) {
      break
    }

    combined = combined ? `${combined}\n\n${text}` : text
    const audioValue = tryAudioEmbedFromCombinedText(combined)
    if (audioValue) {
      return {
        length: index - startIndex + 1,
        value: audioValue,
      }
    }
  }

  return null
}
