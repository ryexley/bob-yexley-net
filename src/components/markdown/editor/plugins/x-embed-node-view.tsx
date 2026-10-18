import type { Node } from "@milkdown/prose/model"
import { NodeSelection } from "@milkdown/prose/state"
import type { EditorView, NodeView } from "@milkdown/prose/view"
import { render } from "solid-js/web"
import {
  xEmbedDataAttributes,
  xEmbedEditorAttrsFromUnknown,
  X_EMBED_NODE,
} from "@/components/markdown/x/x-embed-syntax"
import { XEmbedWidget } from "@/components/markdown/x/x-embed"

export function createXEmbedNodeView(
  node: Node,
  view: EditorView,
  getPos?: () => number | undefined,
): NodeView {
  const dom = document.createElement("div")
  let current = node
  let dispose: (() => void) | undefined

  const paint = () => {
    const props = xEmbedEditorAttrsFromUnknown(current.attrs)
    const selected = dom.classList.contains("is-selected")
    dom.className = "x-embed"
    if (selected) {
      dom.classList.add("is-selected")
    }
    for (const [name, value] of Object.entries(xEmbedDataAttributes(props))) {
      dom.setAttribute(name, value)
    }
    dispose?.()
    dispose = render(() => <XEmbedWidget {...props} />, dom)
  }

  const selectThisNode = (event: MouseEvent) => {
    if (event.button !== 0) {
      return
    }
    const pos = getPos?.()
    if (typeof pos !== "number") {
      return
    }
    const nodeAt = view.state.doc.nodeAt(pos)
    if (!nodeAt || nodeAt.type.name !== X_EMBED_NODE) {
      return
    }
    event.preventDefault()
    const selection = NodeSelection.create(view.state.doc, pos)
    if (!view.state.selection.eq(selection)) {
      view.dispatch(view.state.tr.setSelection(selection))
    }
  }

  dom.contentEditable = "false"
  dom.addEventListener("mousedown", selectThisNode)
  paint()

  return {
    dom,
    update(next) {
      if (next.type.name !== X_EMBED_NODE) {
        return false
      }
      const previous = xEmbedEditorAttrsFromUnknown(current.attrs)
      const upcoming = xEmbedEditorAttrsFromUnknown(next.attrs)
      current = next
      if (previous.id === upcoming.id && previous.url === upcoming.url) {
        return true
      }
      paint()
      return true
    },
    selectNode() {
      dom.classList.add("is-selected")
    },
    deselectNode() {
      dom.classList.remove("is-selected")
    },
    ignoreMutation: () => true,
    stopEvent: event =>
      event.type === "mousedown" ||
      event.type === "mouseup" ||
      event.type === "click",
    destroy() {
      dom.removeEventListener("mousedown", selectThisNode)
      dispose?.()
    },
  }
}
