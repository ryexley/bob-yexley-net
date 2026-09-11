import { commandsCtx, schemaCtx } from "@milkdown/core"
import { $command, $prose, $useKeymap } from "@milkdown/utils"
import { Fragment } from "@milkdown/prose/model"
import { Plugin, PluginKey, TextSelection } from "@milkdown/prose/state"
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

function ensureTrailingParagraph(view: EditorView) {
  const { state } = view
  const lastChild = state.doc.lastChild
  if (!lastChild || lastChild.type.name !== MEDIA_EMBED_NODE) {
    return
  }
  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) {
    return
  }
  view.dispatch(
    state.tr
      .insert(state.doc.content.size, paragraph.create())
      .setMeta("addToHistory", false),
  )
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
    if (!dispatch) {
      return true
    }
    const fragment = Fragment.fromArray(nodes)
    let transaction = state.tr.replaceSelectionWith(nodes[0]!, false)
    if (nodes.length > 1) {
      const insertPos = transaction.selection.from
      transaction = transaction.insert(
        insertPos,
        fragment.cut(nodes[0]!.nodeSize),
      )
    }
    const after = transaction.selection.to
    const found = TextSelection.findFrom(transaction.doc.resolve(after), 1)
    dispatch(
      (found ? transaction.setSelection(found) : transaction).scrollIntoView(),
    )
    return true
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
      ensureTrailingParagraph(view)
      return {
        update(nextView) {
          ensureTrailingParagraph(nextView)
        },
      }
    },
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some(transaction => transaction.docChanged)) {
        return null
      }
      const lastChild = newState.doc.lastChild
      if (!lastChild || lastChild.type.name !== MEDIA_EMBED_NODE) {
        return null
      }
      const paragraph = newState.schema.nodes.paragraph
      if (!paragraph) {
        return null
      }
      return newState.tr
        .insert(newState.doc.content.size, paragraph.create())
        .setMeta("addToHistory", false)
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
