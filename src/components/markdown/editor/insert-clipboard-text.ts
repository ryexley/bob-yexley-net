import { Fragment, Slice } from "@milkdown/prose/model"
import type { EditorState, Transaction } from "@milkdown/prose/state"
import type { EditorView } from "@milkdown/prose/view"

export function applyClipboardText(
  state: EditorState,
  dispatch: ((transaction: Transaction) => void) | undefined,
  text: string,
): boolean {
  const value = text.replace(/\r\n/g, "\n")
  if (!value) {
    return false
  }
  if (!dispatch) {
    return true
  }

  if (!value.includes("\n")) {
    dispatch(state.tr.insertText(value).scrollIntoView())
    return true
  }

  const paragraphType = state.schema.nodes.paragraph
  if (!paragraphType) {
    dispatch(state.tr.insertText(value.replace(/\n+/g, " ")).scrollIntoView())
    return true
  }

  const blocks = value
    .split("\n")
    .map(line =>
      paragraphType.create(
        null,
        line === "" ? undefined : state.schema.text(line),
      ),
    )
  dispatch(
    state.tr
      .replaceSelection(new Slice(Fragment.from(blocks), 0, 0))
      .scrollIntoView(),
  )
  return true
}

export function insertClipboardText(view: EditorView, text: string): boolean {
  const applied = applyClipboardText(view.state, view.dispatch.bind(view), text)
  if (applied) {
    view.focus()
  }
  return applied
}
