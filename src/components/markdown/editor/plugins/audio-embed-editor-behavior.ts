import { commandsCtx } from "@milkdown/core"
import { $command, $prose, $useKeymap } from "@milkdown/utils"
import { exitCode } from "@milkdown/prose/commands"
import { gapCursor } from "@milkdown/prose/gapcursor"
import { Plugin, PluginKey, Selection, type EditorState } from "@milkdown/prose/state"
import type { EditorView } from "@milkdown/prose/view"

const AUDIO_EMBED_NODE = "audio_embed"
const trailingParagraphKey = new PluginKey("audioEmbedTrailingParagraph")

function selectionInAudioEmbed(state: EditorState) {
  const { $from } = state.selection
  if ($from.parent.type.name === AUDIO_EMBED_NODE) {
    return true
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === AUDIO_EMBED_NODE) {
      return true
    }
  }

  return false
}

function isCursorAtAudioEmbedEnd(state: EditorState) {
  const { $head } = state.selection
  if ($head.parent.type.name !== AUDIO_EMBED_NODE) {
    return false
  }

  return $head.pos >= $head.end($head.depth)
}

function ensureTrailingParagraph(view: EditorView) {
  const { state } = view
  const lastChild = state.doc.lastChild
  if (!lastChild || lastChild.type.name !== AUDIO_EMBED_NODE) {
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

export const exitAudioEmbedCommand = $command("ExitAudioEmbed", () => () => exitCode)

export const arrowDownFromAudioEmbedCommand = $command(
  "ArrowDownFromAudioEmbed",
  () => () => (state, dispatch) => {
    if (!selectionInAudioEmbed(state)) {
      return false
    }

    if (!isCursorAtAudioEmbedEnd(state)) {
      return false
    }

    const nextSelection = Selection.findFrom(
      state.doc.resolve(state.selection.$head.after()),
      1,
    )
    if (nextSelection) {
      dispatch?.(state.tr.setSelection(nextSelection).scrollIntoView())
      return true
    }

    return exitCode(state, dispatch)
  },
)

export const audioEmbedKeymap = $useKeymap("audioEmbedKeymap", {
  ExitAudioEmbed: {
    shortcuts: "Mod-Enter",
    command: ctx => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(exitAudioEmbedCommand.key)
    },
  },
  ArrowDownFromAudioEmbed: {
    shortcuts: "ArrowDown",
    command: ctx => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(arrowDownFromAudioEmbedCommand.key)
    },
  },
})

export const audioEmbedGapCursorPlugin = $prose(() => gapCursor())

export const audioEmbedTrailingParagraphPlugin = $prose(() => {
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
      if (!lastChild || lastChild.type.name !== AUDIO_EMBED_NODE) {
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
