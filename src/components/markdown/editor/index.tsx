import {
  createEffect,
  createSignal,
  onCleanup,
  mergeProps,
  splitProps,
  Show,
  type Component,
  type JSX,
} from "solid-js"
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  prosePluginsCtx,
} from "@milkdown/core"
import { commonmark } from "@milkdown/preset-commonmark"
import { listener, listenerCtx } from "@milkdown/plugin-listener"
import { emoji } from "@milkdown/plugin-emoji"
import { history } from "@milkdown/prose/history"
import { clsx as cx, isEmpty } from "@/util"
import { withWindow } from "@/util/browser"
import { placeholder } from "./plugins/placeholder"
import {
  applyFormat,
  getActiveFormats,
  getDisabledFormats,
  getLinkSelectionState,
} from "./commands"
import Toolbar from "./toolbar"
import { StatusBar } from "./status-bar"
import "@milkdown/theme-nord/style.css"
import "./theme.css"
import "./styles.css"

interface MarkdownEditorProps {
  instanceKey: string
  initialValue?: string
  placeholder?: string
  onChange?: (markdown: string) => void
  showToolbar?: boolean
  showStatusBar?: boolean
  class?: string
  Header?: Component
  statusText?: string
  statusIcon?: JSX.Element
  showStatus?: boolean
  statusFading?: boolean
  statusActions?: Component<any>
  statusContext?: any
}

const propDefaults = {
  showToolbar: true,
  showStatusBar: true,
}

const toolbarVisibleStorageKey = (instanceKey: string) =>
  isEmpty(instanceKey)
    ? "markdown-editor:toolbar-visible"
    : `markdown-editor:${instanceKey}:toolbar-visible`

export function MarkdownEditor(props: MarkdownEditorProps) {
  const propsWithDefaults = mergeProps(propDefaults, props)
  const [local, rest] = splitProps(propsWithDefaults, [
    "instanceKey",
    "initialValue",
    "placeholder",
    "onChange",
    "showToolbar",
    "showStatusBar",
    "class",
    "Header",
    "statusText",
    "statusIcon",
    "showStatus",
    "statusFading",
    "statusActions",
    "statusContext",
  ])

  let editorRef: HTMLDivElement | undefined
  let editorInstance: Editor | undefined
  let editorKeydownCleanup: (() => void) | undefined
  const [activeFormats, setActiveFormats] = createSignal<string[]>([])
  const [disabledFormats, setDisabledFormats] = createSignal<string[]>([])
  const [selectedText, setSelectedText] = createSignal("")
  const [selectedLinkHref, setSelectedLinkHref] = createSignal("")
  const [selectedLinkRangeFrom, setSelectedLinkRangeFrom] = createSignal<
    number | undefined
  >(undefined)
  const [selectedLinkRangeTo, setSelectedLinkRangeTo] = createSignal<
    number | undefined
  >(undefined)
  const [linkEditorRequestNonce, setLinkEditorRequestNonce] = createSignal(0)
  const [toolbarVisible, setToolbarVisible] = createSignal(
    withWindow(
      () => {
        return (
          localStorage.getItem(toolbarVisibleStorageKey(local.instanceKey)) !==
          "false"
        )
      },
      () => local.showToolbar,
    ),
  )

  const handleApplyFormat = (format: string, payload?: any) => {
    if (!editorInstance) {
      return
    }

    applyFormat(editorInstance, format, payload)
    syncToolbarState()
  }

  const syncToolbarState = () => {
    if (!editorInstance) {
      return
    }

    setActiveFormats(getActiveFormats(editorInstance))
    setDisabledFormats(getDisabledFormats(editorInstance))
    const linkSelectionState = getLinkSelectionState(editorInstance)
    setSelectedText(linkSelectionState.selectedText)
    setSelectedLinkHref(linkSelectionState.selectedLinkHref)
    setSelectedLinkRangeFrom(linkSelectionState.rangeFrom)
    setSelectedLinkRangeTo(linkSelectionState.rangeTo)
  }

  // Create editor only once when editorRef is available
  // Use untrack to prevent re-running when initialValue changes
  createEffect(() => {
    if (!editorRef || editorInstance) {
      return
    }

    // Capture initialValue once, non-reactively
    const initialValue = local.initialValue || ""

    Editor.make()
      .config(ctx => {
        ctx.set(rootCtx, editorRef)
        ctx.set(defaultValueCtx, initialValue)
        ctx.update(prosePluginsCtx, prev => [...prev, history()])
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          local.onChange?.(markdown)
        })
        ctx.get(listenerCtx).selectionUpdated(() => {
          syncToolbarState()
        })
        ctx.get(listenerCtx).updated(() => {
          syncToolbarState()
        })
      })
      .use(commonmark)
      .use(placeholder(local.placeholder))
      .use(emoji)
      .use(listener)
      .create()
      .then(e => {
        editorInstance = e
        e.action(ctx => {
          const editorDom = ctx.get(editorViewCtx).dom
          const handleKeyDown = (event: KeyboardEvent) => {
            const isModKey = event.metaKey || event.ctrlKey
            if (!isModKey) {
              return
            }

            const key = event.key.toLowerCase()
            if (key === "z") {
              event.preventDefault()
              handleApplyFormat(event.shiftKey ? "redo" : "undo")
              return
            }

            if (key === "k") {
              event.preventDefault()
              if (!toolbarVisible()) {
                setToolbarVisible(true)
              }

              syncToolbarState()
              setLinkEditorRequestNonce(prev => prev + 1)
            }
          }

          editorDom.addEventListener("keydown", handleKeyDown)
          editorKeydownCleanup = () => {
            editorDom.removeEventListener("keydown", handleKeyDown)
          }
        })
        syncToolbarState()
      })
  })

  createEffect(() => {
    withWindow(() => {
      localStorage.setItem(
        toolbarVisibleStorageKey(local.instanceKey),
        String(toolbarVisible()),
      )
    })
  })

  onCleanup(() => {
    editorKeydownCleanup?.()
    editorInstance?.destroy()
  })

  const handleToggleToolbar = () => {
    const visible = !toolbarVisible()
    setToolbarVisible(visible)
  }

  const focusEditor = () => {
    if (!editorInstance) {
      return
    }

    editorInstance.action(ctx => {
      ctx.get(editorViewCtx).focus()
    })
  }

  return (
    <div class={cx("markdown-editor", local.class)}>
      <Show when={local.Header}>{local.Header?.({})}</Show>
      <div
        class="editor-container"
        {...rest}>
        <Toolbar
          visible={toolbarVisible()}
          activeFormats={activeFormats()}
          disabledFormats={disabledFormats()}
          selectedText={selectedText()}
          selectedLinkHref={selectedLinkHref()}
          selectedLinkRangeFrom={selectedLinkRangeFrom()}
          selectedLinkRangeTo={selectedLinkRangeTo()}
          linkEditorRequestNonce={linkEditorRequestNonce()}
          onRequestEditorFocus={focusEditor}
          onFormatApply={handleApplyFormat}
        />
        <div
          ref={editorRef}
          data-placeholder={local.placeholder}
        />
      </div>
      {local.showStatusBar ? (
        <StatusBar
          onToggleToolbar={handleToggleToolbar}
          statusText={local.statusText}
          statusIcon={local.statusIcon}
          showStatus={local.showStatus}
          statusFading={local.statusFading}
          actions={local.statusActions}
          context={local.statusContext}
        />
      ) : null}
    </div>
  )
}
