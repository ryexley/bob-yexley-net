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
import type { MediaType } from "@/modules/media/filename"
import {
  mediaEmbedPropsToAttrs,
  MEDIA_EMBED_NODE,
} from "@/components/markdown/media/media-embed-syntax"
import { getMediaEmbedRuntime } from "./media-embed-runtime"

export type MediaEmbedInsert = {
  key: string
  mediaType: MediaType
  mimeType?: string
}

const trailingParagraphKey = new PluginKey("mediaEmbedTrailingParagraph")
const removedKey = new PluginKey("mediaEmbedRemoved")
const clipboardKey = new PluginKey("mediaEmbedClipboard")

function collectMediaEmbedKeys(doc: {
  descendants: (
    fn: (node: {
      type: { name: string }
      attrs: Record<string, unknown>
    }) => void,
  ) => void
}) {
  const keys = new Set<string>()
  doc.descendants(node => {
    if (node.type.name === MEDIA_EMBED_NODE) {
      const key = String(node.attrs.key ?? "")
      if (key) {
        keys.add(key)
      }
    }
  })
  return keys
}

function isEmptyParagraph(node: Node | null | undefined): boolean {
  return node?.type.name === "paragraph" && node.content.size === 0
}

/**
 * End position of a leading run of empty paragraphs that sit immediately
 * before a `media_embed`. Used so a paste into an empty composer does not
 * leave a dead line above the image that phones cannot Backspace away.
 */
export function leadingEmptyParagraphsBeforeMediaEnd(doc: Node): number {
  for (let index = 0; index < doc.childCount; index += 1) {
    const child = doc.child(index)
    if (isEmptyParagraph(child)) {
      continue
    }
    if (child.type.name === MEDIA_EMBED_NODE && index > 0) {
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

export function mediaEmbedHygieneTransaction(
  state: EditorState,
): Transaction | null {
  let transaction = state.tr
  let changed = false

  const leadingEnd = leadingEmptyParagraphsBeforeMediaEnd(transaction.doc)
  if (leadingEnd > 0) {
    transaction = transaction.delete(0, leadingEnd)
    changed = true
  }

  const doc = transaction.doc
  if (doc.lastChild?.type.name === MEDIA_EMBED_NODE) {
    const paragraph = state.schema.nodes.paragraph
    if (paragraph) {
      transaction = transaction.insert(doc.content.size, paragraph.create())
      changed = true
    }
  }

  return changed ? transaction.setMeta("addToHistory", false) : null
}

function applyMediaEmbedHygiene(view: EditorView) {
  const transaction = mediaEmbedHygieneTransaction(view.state)
  if (transaction) {
    view.dispatch(transaction)
  }
}

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

export function insertMediaEmbedNodes(
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

/** Backspace in an empty paragraph immediately before an inline embed. */
export function deleteEmptyParagraphBeforeMedia(
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
  if (next?.type.name !== MEDIA_EMBED_NODE) {
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

export const insertMediaEmbedCommand = $command<
  MediaEmbedInsert | MediaEmbedInsert[],
  "InsertMediaEmbed"
>("InsertMediaEmbed", ctx => payload => {
  return (state, dispatch) => {
    const items =
      payload == null ? [] : Array.isArray(payload) ? payload : [payload]
    if (items.length === 0) {
      return false
    }
    const type = ctx.get(schemaCtx).nodes[MEDIA_EMBED_NODE]
    if (!type) {
      return false
    }
    const nodes = items.map(item =>
      type.create(
        mediaEmbedPropsToAttrs({
          key: item.key,
          type: item.mediaType,
          mime: item.mimeType,
        }),
      ),
    )
    return insertMediaEmbedNodes(state, dispatch, nodes)
  }
})

export const mediaEmbedKeymap = $useKeymap("mediaEmbedKeymap", {
  InsertMediaEmbed: {
    shortcuts: [],
    command: ctx => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(insertMediaEmbedCommand.key)
    },
  },
})

export const mediaEmbedTrailingParagraphPlugin = $prose(() => {
  return new Plugin({
    key: trailingParagraphKey,
    view(view) {
      applyMediaEmbedHygiene(view)
      return {
        update(nextView) {
          applyMediaEmbedHygiene(nextView)
        },
      }
    },
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some(transaction => transaction.docChanged)) {
        return null
      }
      return mediaEmbedHygieneTransaction(newState)
    },
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Backspace") {
          return false
        }
        return deleteEmptyParagraphBeforeMedia(
          view.state,
          view.dispatch.bind(view),
        )
      },
    },
  })
})

export const mediaEmbedClipboardPlugin = $prose(() => {
  return new Plugin({
    key: clipboardKey,
    props: {
      handlePaste(_view, event) {
        return getMediaEmbedRuntime()?.consumeClipboardPaste?.(event) === true
      },
    },
  })
})

export const mediaEmbedRemovedPlugin = $prose(() => {
  return new Plugin({
    key: removedKey,
    view() {
      return {
        update(view, prevState) {
          if (view.state.doc.eq(prevState.doc)) {
            return
          }
          const previous = collectMediaEmbedKeys(prevState.doc)
          const next = collectMediaEmbedKeys(view.state.doc)
          const onRemoved = getMediaEmbedRuntime()?.onNodeRemoved
          if (!onRemoved) {
            return
          }
          for (const key of previous) {
            if (!next.has(key)) {
              onRemoved(key)
            }
          }
        },
      }
    },
  })
})
