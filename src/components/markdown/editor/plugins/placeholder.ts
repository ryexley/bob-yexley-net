import { $prose } from "@milkdown/utils"
import { Plugin, PluginKey } from "@milkdown/prose/state"
import { Decoration, DecorationSet } from "@milkdown/prose/view"

// Use a simple string directly in the plugin, no context needed
const placeholderKey = new PluginKey("MilkdownPlaceholder")

export const placeholder = (text: string = "Write with Markdown...") =>
  $prose(() => {
    return new Plugin({
      key: placeholderKey,
      props: {
        decorations(state) {
          const doc = state.doc

          const isEmpty =
            doc.childCount === 1 &&
            doc.firstChild?.isTextblock &&
            doc.firstChild.content.size === 0

          if (!isEmpty) {
            return DecorationSet.empty
          }

          const placeholder = document.createElement("span")
          placeholder.className = "milkdown-placeholder"
          placeholder.textContent = text

          return DecorationSet.create(doc, [
            Decoration.widget(1, placeholder, {
              side: -1,
              key: "placeholder",
            }),
          ])
        },
      },
    })
  })
