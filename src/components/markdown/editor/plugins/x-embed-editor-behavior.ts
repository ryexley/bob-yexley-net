import { commandsCtx, schemaCtx } from "@milkdown/core"
import { $command, $prose, $useKeymap } from "@milkdown/utils"
import { Fragment, type Node } from "@milkdown/prose/model"
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@milkdown/prose/state"
import type { EditorView } from "@milkdown/prose/view"
import {
  parseXEmbedBlock,
  parseXStatusUrl,
  X_EMBED_NODE,
  type XEmbedProps,
} from "@/components/markdown/x/x-embed-syntax"

const trailingParagraphKey = new PluginKey("xEmbedTrailingParagraph")
const clipboardKey = new PluginKey("xEmbedClipboard")

function stripInvisibleText(value: string): string {
  return value
    .replaceAll("\u200b", "")
    .replaceAll("\u200c", "")
    .replaceAll("\u200d", "")
    .replaceAll("\ufeff", "")
}

function isBreakLikeHtml(node: Node): boolean {
  if (node.type.name !== "html") {
    return false
  }
  const value = String(node.attrs.value ?? "").trim()
  return /^<br\b[^>]*>$/i.test(value)
}

function isBlankText(value: string | undefined): boolean {
  return !value || !stripInvisibleText(value).trim()
}

function isEmptyParagraph(node: Node | null | undefined): boolean {
  if (node?.type.name !== "paragraph") {
    return false
  }
  if (node.content.size === 0) {
    return true
  }
  let empty = true
  node.forEach(child => {
    if (!empty) {
      return
    }
    if (
      child.type.name === "hard_break" ||
      child.type.name === "hardbreak" ||
      isBreakLikeHtml(child)
    ) {
      return
    }
    if (child.isText && isBlankText(child.text)) {
      return
    }
    empty = false
  })
  return empty
}

function xEmbedPropsFromParagraph(node: Node): XEmbedProps | null {
  if (node.type.name !== "paragraph") {
    return null
  }
  const text = stripInvisibleText(node.textContent).trim()
  return parseXStatusUrl(text) ?? parseXEmbedBlock(text)
}

/** Prefer text/plain; iOS often only puts the status URL in text/html. */
export function xStatusUrlFromClipboard(
  data: DataTransfer | null | undefined,
): string | null {
  if (!data) {
    return null
  }
  const plain = data.getData("text/plain")
  if (parseXStatusUrl(plain)) {
    return plain
  }
  const html = data.getData("text/html")
  if (!html) {
    return null
  }
  const matches =
    html.match(
      /https?:\/\/(?:www\.)?(?:mobile\.)?(?:twitter|x)\.com\/[^\s"'<>]+/gi,
    ) ?? []
  return matches.find(candidate => parseXStatusUrl(candidate)) ?? null
}

function promoteXEmbedParagraphs(
  state: EditorState,
  transaction: Transaction,
): Transaction {
  const type = state.schema.nodes[X_EMBED_NODE]
  if (!type) {
    return transaction
  }
  const replacements: Array<{ from: number; to: number; node: Node }> = []
  transaction.doc.forEach((child, offset) => {
    const props = xEmbedPropsFromParagraph(child)
    if (!props) {
      return
    }
    replacements.push({
      from: offset,
      to: offset + child.nodeSize,
      node: type.create(props),
    })
  })
  return replacements.reduceRight(
    (next, replacement) =>
      next.replaceWith(replacement.from, replacement.to, replacement.node),
    transaction,
  )
}

/**
 * End position of a leading run of empty paragraphs that sit immediately
 * before an X embed. Paste into an empty composer (especially on iOS) can
 * leave a dead line above the widget that Backspace cannot remove.
 */
export function leadingEmptyParagraphsBeforeXEmbedEnd(doc: Node): number {
  for (let index = 0; index < doc.childCount; index += 1) {
    const child = doc.child(index)
    if (isEmptyParagraph(child)) {
      continue
    }
    if (child.type.name === X_EMBED_NODE && index > 0) {
      let end = 0
      for (let leading = 0; leading < index; leading += 1) {
        end += doc.child(leading).nodeSize
      }
      return end
    }
    break
  }
  return 0
}

export function xEmbedHygieneTransaction(
  state: EditorState,
): Transaction | null {
  let transaction = promoteXEmbedParagraphs(state, state.tr)
  let changed = !transaction.doc.eq(state.doc)

  const leadingEnd = leadingEmptyParagraphsBeforeXEmbedEnd(transaction.doc)
  if (leadingEnd > 0) {
    transaction = transaction.delete(0, leadingEnd)
    changed = true
  }

  const doc = transaction.doc
  if (doc.lastChild?.type.name === X_EMBED_NODE) {
    const paragraph = state.schema.nodes.paragraph
    if (paragraph) {
      transaction = transaction.insert(doc.content.size, paragraph.create())
      changed = true
    }
  }

  return changed ? transaction.setMeta("addToHistory", false) : null
}

/** Backspace in an empty paragraph immediately before an X embed. */
export function deleteEmptyParagraphBeforeXEmbed(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void,
): boolean {
  const { $from, empty } = state.selection
  if (!empty || $from.depth !== 1) {
    return false
  }
  if (!isEmptyParagraph($from.parent)) {
    return false
  }
  const index = $from.index(0)
  const next = $from.node(0).maybeChild(index + 1)
  if (next?.type.name !== X_EMBED_NODE) {
    return false
  }
  if (!dispatch) {
    return true
  }
  const from = $from.before()
  const to = $from.after()
  const transaction = state.tr.delete(from, to)
  const found = TextSelection.findFrom(transaction.doc.resolve(from), 1)
  dispatch(found ? transaction.setSelection(found) : transaction)
  return true
}

function tryReplaceEmptyTextblock(
  state: EditorState,
  fragment: Fragment,
): Transaction | null {
  const { $from } = state.selection
  const parent = $from.parent
  if (!parent.isTextblock || !isEmptyParagraph(parent)) {
    return null
  }
  const depth = $from.depth
  const from = $from.before(depth)
  const to = $from.after(depth)
  const container = $from.node(depth - 1)
  const index = $from.index(depth - 1)
  if (!container.canReplace(index, index + 1, fragment)) {
    return null
  }
  return state.tr.replaceWith(from, to, fragment)
}

export function insertXEmbedNodes(
  state: EditorState,
  dispatch: ((transaction: Transaction) => void) | undefined,
  nodes: Node[],
): boolean {
  if (nodes.length === 0) {
    return false
  }
  if (!dispatch) {
    return true
  }

  const fragment = Fragment.fromArray(nodes)
  let transaction = tryReplaceEmptyTextblock(state, fragment)
  if (!transaction) {
    transaction = state.tr.replaceSelectionWith(nodes[0]!, false)
    if (nodes.length > 1) {
      transaction = transaction.insert(
        transaction.selection.from,
        fragment.cut(nodes[0]!.nodeSize),
      )
    }
  }

  const after = transaction.selection.to
  const found = TextSelection.findFrom(transaction.doc.resolve(after), 1)
  dispatch(
    (found ? transaction.setSelection(found) : transaction).scrollIntoView(),
  )
  return true
}

export function insertXEmbedFromText(view: EditorView, text: string): boolean {
  const props = parseXStatusUrl(text)
  if (!props) {
    return false
  }
  const type = view.state.schema.nodes[X_EMBED_NODE]
  if (!type) {
    return false
  }
  return insertXEmbedNodes(view.state, view.dispatch.bind(view), [
    type.create(props),
  ])
}

export const insertXEmbedCommand = $command<XEmbedProps, "InsertXEmbed">(
  "InsertXEmbed",
  ctx => payload => {
    return (state, dispatch) => {
      if (!payload) {
        return false
      }
      const type = ctx.get(schemaCtx).nodes[X_EMBED_NODE]
      if (!type) {
        return false
      }
      return insertXEmbedNodes(state, dispatch, [type.create(payload)])
    }
  },
)

export const xEmbedKeymap = $useKeymap("xEmbedKeymap", {
  InsertXEmbed: {
    shortcuts: [],
    command: ctx => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(insertXEmbedCommand.key)
    },
  },
})

function applyXEmbedHygiene(view: EditorView) {
  const transaction = xEmbedHygieneTransaction(view.state)
  if (transaction) {
    view.dispatch(transaction)
  }
}

export const xEmbedTrailingParagraphPlugin = $prose(() => {
  return new Plugin({
    key: trailingParagraphKey,
    view(view) {
      applyXEmbedHygiene(view)
      return {
        update(nextView) {
          applyXEmbedHygiene(nextView)
        },
      }
    },
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some(transaction => transaction.docChanged)) {
        return null
      }
      return xEmbedHygieneTransaction(newState)
    },
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Backspace") {
          return false
        }
        return deleteEmptyParagraphBeforeXEmbed(
          view.state,
          view.dispatch.bind(view),
        )
      },
      handleDOMEvents: {
        beforeinput(view, event) {
          if (!(event instanceof InputEvent)) {
            return false
          }
          if (event.inputType !== "deleteContentBackward") {
            return false
          }
          if (
            !deleteEmptyParagraphBeforeXEmbed(
              view.state,
              view.dispatch.bind(view),
            )
          ) {
            return false
          }
          event.preventDefault()
          return true
        },
      },
    },
  })
})

export const xEmbedClipboardPlugin = $prose(() => {
  return new Plugin({
    key: clipboardKey,
    props: {
      handlePaste(view, event) {
        const text = xStatusUrlFromClipboard(event.clipboardData)
        if (!text) {
          return false
        }
        event.preventDefault()
        return insertXEmbedFromText(view, text)
      },
    },
  })
})
