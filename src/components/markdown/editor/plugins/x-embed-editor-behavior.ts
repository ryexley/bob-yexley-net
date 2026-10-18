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
  parseXStatusUrl,
  X_EMBED_NODE,
  type XEmbedProps,
} from "@/components/markdown/x/x-embed-syntax"

const trailingParagraphKey = new PluginKey("xEmbedTrailingParagraph")
const clipboardKey = new PluginKey("xEmbedClipboard")

function tryReplaceEmptyTextblock(
  state: EditorState,
  fragment: Fragment,
): Transaction | null {
  const { $from } = state.selection
  const parent = $from.parent
  if (!parent.isTextblock || parent.content.size !== 0) {
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

function xEmbedHygieneTransaction(state: EditorState): Transaction | null {
  const lastChild = state.doc.lastChild
  if (!lastChild || lastChild.type.name !== X_EMBED_NODE) {
    return null
  }
  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) {
    return null
  }
  return state.tr
    .insert(state.doc.content.size, paragraph.create())
    .setMeta("addToHistory", false)
}

export const xEmbedTrailingParagraphPlugin = $prose(() => {
  return new Plugin({
    key: trailingParagraphKey,
    view(view) {
      const transaction = xEmbedHygieneTransaction(view.state)
      if (transaction) {
        view.dispatch(transaction)
      }
      return {
        update(nextView) {
          const next = xEmbedHygieneTransaction(nextView.state)
          if (next) {
            nextView.dispatch(next)
          }
        },
      }
    },
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some(transaction => transaction.docChanged)) {
        return null
      }
      return xEmbedHygieneTransaction(newState)
    },
  })
})

export const xEmbedClipboardPlugin = $prose(() => {
  return new Plugin({
    key: clipboardKey,
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain") ?? ""
        if (!parseXStatusUrl(text)) {
          return false
        }
        event.preventDefault()
        return insertXEmbedFromText(view, text)
      },
    },
  })
})
