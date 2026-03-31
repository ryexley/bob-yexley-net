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
import { Stack } from "@/components/stack"
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
  focusNonce?: number
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
  BelowEditor?: Component<MarkdownEditorBelowEditorProps>
}

export type MarkdownEditorBelowEditorProps = {
  onToggleToolbar: () => void
  toolbarVisible: boolean
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
    "focusNonce",
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
    "BelowEditor",
  ])

  let editorRef: HTMLDivElement | undefined
  let editorInstance: Editor | undefined
  let editorKeydownCleanup: (() => void) | undefined
  let focusRetryTimeout: ReturnType<typeof setTimeout> | undefined
  let pendingFocusAfterMount = false
  let lastHandledFocusNonce: number | undefined
  let disposed = false
  let editorCreateGeneration = 0
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

  const clearFocusRetryTimeout = () => {
    if (focusRetryTimeout) {
      clearTimeout(focusRetryTimeout)
      focusRetryTimeout = undefined
    }
  }

  const scheduleEditorFocus = () => {
    queueMicrotask(() => {
      focusEditor()
    })

    clearFocusRetryTimeout()
    focusRetryTimeout = setTimeout(() => {
      focusEditor()
      focusRetryTimeout = undefined
    }, 0)
  }

  // Create editor only once when editorRef is available
  // Use untrack to prevent re-running when initialValue changes
  createEffect(() => {
    if (!editorRef || editorInstance) {
      return
    }

    const generation = ++editorCreateGeneration
    // Capture initialValue once, non-reactively
    const initialValue = local.initialValue || ""

    Editor.make()
      .config(ctx => {
        ctx.set(rootCtx, editorRef)
        ctx.set(defaultValueCtx, initialValue)
        ctx.update(prosePluginsCtx, prev => [...prev, history()])
        ctx.get(listenerCtx).mounted(() => {
          if (!pendingFocusAfterMount) {
            return
          }

          pendingFocusAfterMount = false
          scheduleEditorFocus()
        })
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
        if (disposed || generation !== editorCreateGeneration) {
          void e.destroy(true)
          return
        }

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
      .catch(error => {
        console.error("Failed to create Milkdown editor:", error)
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

  createEffect(() => {
    const focusNonce = local.focusNonce
    if (focusNonce === undefined) {
      return
    }

    if (focusNonce === lastHandledFocusNonce) {
      return
    }

    lastHandledFocusNonce = focusNonce
    if (editorInstance) {
      scheduleEditorFocus()
      return
    }

    pendingFocusAfterMount = true
  })

  onCleanup(() => {
    disposed = true
    editorCreateGeneration += 1
    pendingFocusAfterMount = false
    clearFocusRetryTimeout()
    editorKeydownCleanup?.()
    editorKeydownCleanup = undefined
    const currentEditor = editorInstance
    editorInstance = undefined
    if (currentEditor) {
      void currentEditor.destroy(true)
    }
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
      const editorView = ctx.get(editorViewCtx)
      const editorDom = editorView.dom as HTMLElement
      const proseMirror = (
        editorDom.matches(".ProseMirror")
          ? editorDom
          : editorDom.querySelector(".ProseMirror")
      ) as HTMLElement | null

      try {
        editorView.focus()
      } catch {}

      try {
        if (proseMirror) {
          proseMirror.focus({ preventScroll: true })
          return
        }
      } catch {}

      try {
        editorDom.focus({ preventScroll: true })
      } catch {
        editorView.focus()
      }
    })
  }

  return (
    <div class={cx("markdown-editor", local.class)}>
      <Show when={local.Header}>{local.Header?.({})}</Show>
      <Stack gap="0.5rem">
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
        <Show when={local.BelowEditor}>
          {local.BelowEditor?.({
            onToggleToolbar: handleToggleToolbar,
            toolbarVisible: toolbarVisible(),
            statusText: local.statusText,
            statusIcon: local.statusIcon,
            showStatus: local.showStatus,
            statusFading: local.statusFading,
            statusActions: local.statusActions,
            statusContext: local.statusContext,
          })}
        </Show>
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
      </Stack>
    </div>
  )
}
