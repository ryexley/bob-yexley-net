import {
  commandsCtx,
  editorStateCtx,
  editorViewCtx,
  schemaCtx,
} from "@milkdown/core"
import { redo, redoDepth, undo, undoDepth } from "@milkdown/prose/history"
import { TextSelection } from "@milkdown/prose/state"
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  insertHrCommand,
  toggleLinkCommand,
} from "@milkdown/preset-commonmark"

export interface FormattingOption {
  key: string
  icon: string
  handler: (ctx: any, payload?: any) => void
  isActive?: (ctx: any) => boolean
  isDisabled?: (ctx: any) => boolean
  group?: number
}

const hasMark = (ctx: any, markName: string) => {
  const state = ctx.get(editorStateCtx)
  const schema = ctx.get(schemaCtx)
  const markType = schema.marks[markName]
  if (!markType) {
    return false
  }

  const { from, $from, to, empty } = state.selection
  if (empty) {
    return !!markType.isInSet(state.storedMarks || $from.marks())
  }

  return state.doc.rangeHasMark(from, to, markType)
}

const hasAncestorNode = (ctx: any, nodeName: string) => {
  const state = ctx.get(editorStateCtx)
  const schema = ctx.get(schemaCtx)
  const nodeType = schema.nodes[nodeName]
  if (!nodeType) {
    return false
  }

  const { $from, $to } = state.selection
  const maxDepth = Math.min($from.depth, $to.depth)

  for (let depth = maxDepth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type === nodeType && $to.node(depth).type === nodeType) {
      return true
    }
  }

  return false
}

export const formattingOptions: FormattingOption[] = [
  {
    key: "undo",
    icon: "undo",
    handler: ctx => {
      const view = ctx.get(editorViewCtx)
      undo(view.state, view.dispatch)
    },
    isDisabled: ctx => undoDepth(ctx.get(editorStateCtx)) <= 0,
    group: 0,
  },
  {
    key: "redo",
    icon: "redo",
    handler: ctx => {
      const view = ctx.get(editorViewCtx)
      redo(view.state, view.dispatch)
    },
    isDisabled: ctx => redoDepth(ctx.get(editorStateCtx)) <= 0,
    group: 0,
  },
  {
    key: "bold",
    icon: "format_bold",
    handler: ctx => {
      const commands = ctx.get(commandsCtx)
      commands.call(toggleStrongCommand.key)
    },
    isActive: ctx => hasMark(ctx, "strong"),
    group: 1,
  },
  {
    key: "italic",
    icon: "format_italic",
    handler: ctx => {
      const commands = ctx.get(commandsCtx)
      commands.call(toggleEmphasisCommand.key)
    },
    isActive: ctx => hasMark(ctx, "emphasis"),
    group: 1,
  },
  {
    key: "blockquote",
    icon: "format_quote",
    handler: ctx => {
      const commands = ctx.get(commandsCtx)
      commands.call(wrapInBlockquoteCommand.key)
    },
    isActive: ctx => hasAncestorNode(ctx, "blockquote"),
    group: 2,
  },
  {
    key: "ul",
    icon: "format_list_bulleted",
    handler: ctx => {
      const commands = ctx.get(commandsCtx)
      commands.call(wrapInBulletListCommand.key)
    },
    isActive: ctx => hasAncestorNode(ctx, "bullet_list"),
    group: 3,
  },
  {
    key: "ol",
    icon: "format_list_numbered",
    handler: ctx => {
      const commands = ctx.get(commandsCtx)
      commands.call(wrapInOrderedListCommand.key)
    },
    isActive: ctx => hasAncestorNode(ctx, "ordered_list"),
    group: 3,
  },
  {
    key: "hr",
    icon: "horizontal_rule",
    handler: ctx => {
      const commands = ctx.get(commandsCtx)
      commands.call(insertHrCommand.key)
    },
    group: 4,
  },
  {
    key: "link",
    icon: "link",
    handler: (
      ctx,
      payload?: {
        href?: string
        text?: string
        remove?: boolean
        rangeFrom?: number
        rangeTo?: number
      },
    ) => {
      const commands = ctx.get(commandsCtx)
      const view = ctx.get(editorViewCtx)
      const state = view.state
      const schema = ctx.get(schemaCtx)
      const linkMark = schema.marks.link
      if (!linkMark) {
        return
      }

      const { from, to } = state.selection
      const hasExplicitRange =
        typeof payload?.rangeFrom === "number" &&
        typeof payload?.rangeTo === "number" &&
        payload.rangeTo >= payload.rangeFrom
      const targetFrom = hasExplicitRange ? payload.rangeFrom : from
      const targetTo = hasExplicitRange ? payload.rangeTo : to

      if (payload?.remove) {
        if (targetFrom !== targetTo) {
          const tr = state.tr.removeMark(targetFrom, targetTo, linkMark)
          tr.setSelection(TextSelection.create(tr.doc, targetTo))
          view.dispatch(tr.scrollIntoView())
          view.focus()
          return
        }

        commands.call(toggleLinkCommand.key)
        return
      }

      if (payload?.href) {
        const targetEmpty = targetFrom === targetTo
        const providedText =
          typeof payload.text === "string" ? payload.text : undefined
        const selectedText = targetEmpty
          ? ""
          : state.doc.textBetween(targetFrom, targetTo, " ")
        const linkText = providedText ?? selectedText
        const linkHref = payload.href.trim()

        if (targetEmpty && !linkText) {
          return
        }

        let tr = state.tr
        if (targetEmpty) {
          const start = targetFrom
          tr = tr.insertText(linkText, start, targetTo)
          const end = start + linkText.length
          tr = tr.addMark(start, end, linkMark.create({ href: linkHref }))
          tr = tr.setSelection(TextSelection.create(tr.doc, end))
        } else {
          const hasTextOverride = typeof providedText === "string"
          if (hasTextOverride && providedText !== selectedText) {
            tr = tr.insertText(providedText, targetFrom, targetTo)
          }

          const end = targetFrom + (hasTextOverride ? providedText.length : targetTo - targetFrom)
          tr = tr.addMark(targetFrom, end, linkMark.create({ href: linkHref }))
          tr = tr.setSelection(TextSelection.create(tr.doc, end))
        }

        view.dispatch(tr.scrollIntoView())
        view.focus()
      }
    },
    isActive: ctx => hasMark(ctx, "link"),
    group: 4,
  },
]
