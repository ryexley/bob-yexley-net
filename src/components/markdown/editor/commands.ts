import {
  editorStateCtx,
  type Editor,
  schemaCtx,
} from "@milkdown/core"
import { formattingOptions } from "./formatting-config"

type LinkSelectionState = {
  selectedText: string
  selectedLinkText: string
  selectionRangeFrom?: number
  selectionRangeTo?: number
  selectedLinkHref: string
  selectedLinkRangeFrom?: number
  selectedLinkRangeTo?: number
}

const wordCharacterPattern = /[a-zA-Z0-9._-]/
const trailingPunctuationPattern = /[.,]$/

const getWordAtCursor = ($from: any): Partial<LinkSelectionState> => {
  const result: Partial<LinkSelectionState> = {}
  const parent = $from.parent
  const parentStart = $from.start()
  const cursorOffset = $from.parentOffset
  let runningOffset = 0

  const textSegments: Array<{
    text: string
    startOffset: number
    endOffset: number
  }> = []

  for (let index = 0; index < parent.childCount; index += 1) {
    const node = parent.child(index)
    if (node.isText) {
      const text = node.text ?? ""
      textSegments.push({
        text,
        startOffset: runningOffset,
        endOffset: runningOffset + text.length,
      })
    }

    runningOffset += node.nodeSize
  }

  const segment = textSegments.find(
    item => cursorOffset >= item.startOffset && cursorOffset <= item.endOffset,
  )
  if (!segment) {
    return result
  }

  const localCursor = Math.max(
    0,
    Math.min(cursorOffset - segment.startOffset, segment.text.length),
  )
  let left = localCursor
  let right = localCursor

  while (left > 0 && wordCharacterPattern.test(segment.text[left - 1])) {
    left -= 1
  }

  while (
    right < segment.text.length &&
    wordCharacterPattern.test(segment.text[right])
  ) {
    right += 1
  }

  while (right > left && trailingPunctuationPattern.test(segment.text[right - 1])) {
    right -= 1
  }

  const selectedText = segment.text.slice(left, right).trim()
  if (!selectedText) {
    return result
  }

  result.selectedText = selectedText
  result.selectionRangeFrom = parentStart + segment.startOffset + left
  result.selectionRangeTo = parentStart + segment.startOffset + right

  return result
}

export function applyFormat(editor: Editor, formatKey: string, payload?: any) {
  const option = formattingOptions.find(opt => opt.key === formatKey)
  if (!option) {
    return
  }

  editor.action(ctx => {
    option.handler(ctx, payload)
  })
}

export function getActiveFormats(editor: Editor): string[] {
  const activeFormats: string[] = []

  editor.action(ctx => {
    for (const option of formattingOptions) {
      if (option.isActive?.(ctx)) {
        activeFormats.push(option.key)
      }
    }
  })

  return activeFormats
}

export function getDisabledFormats(editor: Editor): string[] {
  const disabledFormats: string[] = []

  editor.action(ctx => {
    for (const option of formattingOptions) {
      if (option.isDisabled?.(ctx)) {
        disabledFormats.push(option.key)
      }
    }
  })

  return disabledFormats
}

export function getLinkSelectionState(editor: Editor): LinkSelectionState {
  const selectionState: LinkSelectionState = {
    selectedText: "",
    selectedLinkText: "",
    selectedLinkHref: "",
  }

  editor.action(ctx => {
    const state = ctx.get(editorStateCtx)
    const schema = ctx.get(schemaCtx)
    const linkMark = schema.marks.link
    const { from, to, empty, $from } = state.selection
    if (!empty) {
      selectionState.selectedText = state.doc.textBetween(from, to, " ")
      selectionState.selectedLinkText = selectionState.selectedText
      selectionState.selectionRangeFrom = from
      selectionState.selectionRangeTo = to
      selectionState.selectedLinkRangeFrom = from
      selectionState.selectedLinkRangeTo = to
    } else {
      const cursorWord = getWordAtCursor($from)
      selectionState.selectedText = cursorWord.selectedText ?? ""
      selectionState.selectedLinkText = selectionState.selectedText
      selectionState.selectionRangeFrom = cursorWord.selectionRangeFrom
      selectionState.selectionRangeTo = cursorWord.selectionRangeTo
    }

    if (!linkMark) {
      return
    }

    if (empty) {
      const marks = state.storedMarks ?? $from.marks()
      const activeMark = marks.find(mark => mark.type === linkMark)
      selectionState.selectedLinkHref = activeMark?.attrs?.href ?? ""

      if (!selectionState.selectedLinkHref) {
        return
      }

      const parent = $from.parent
      const index = $from.index()
      const textNodes = parent.content.content
      const getLinkHref = (node: (typeof textNodes)[number]) => {
        const mark = node.marks.find(item => item.type === linkMark)
        return mark?.attrs?.href ?? ""
      }

      const currentNode = textNodes[index]
      if (!currentNode || currentNode.isText !== true) {
        return
      }

      const currentHref = getLinkHref(currentNode)
      if (!currentHref || currentHref !== selectionState.selectedLinkHref) {
        return
      }

      let startIndex = index
      let endIndex = index

      while (startIndex > 0) {
        const previousNode = textNodes[startIndex - 1]
        if (!previousNode || previousNode.isText !== true) {
          break
        }

        if (getLinkHref(previousNode) !== currentHref) {
          break
        }

        startIndex -= 1
      }

      while (endIndex < textNodes.length - 1) {
        const nextNode = textNodes[endIndex + 1]
        if (!nextNode || nextNode.isText !== true) {
          break
        }

        if (getLinkHref(nextNode) !== currentHref) {
          break
        }

        endIndex += 1
      }

      selectionState.selectedLinkText = textNodes
        .slice(startIndex, endIndex + 1)
        .map(node => node.text ?? "")
        .join("")

      const parentStart = $from.start()
      let startOffset = 0
      for (let i = 0; i < startIndex; i += 1) {
        startOffset += parent.child(i).nodeSize
      }

      let endOffset = startOffset
      for (let i = startIndex; i <= endIndex; i += 1) {
        endOffset += parent.child(i).nodeSize
      }

      selectionState.selectedLinkRangeFrom = parentStart + startOffset
      selectionState.selectedLinkRangeTo = parentStart + endOffset
      return
    }

    state.doc.nodesBetween(from, to, node => {
      if (selectionState.selectedLinkHref) {
        return false
      }

      const mark = node.marks.find(item => item.type === linkMark)
      if (mark) {
        selectionState.selectedLinkHref = mark.attrs?.href ?? ""
        return false
      }

      return
    })
  })

  return selectionState
}
