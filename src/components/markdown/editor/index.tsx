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
import { TextSelection } from "@milkdown/prose/state"
import { clsx as cx } from "@/util"
import { withWindow } from "@/util/browser"
import { Stack } from "@/components/stack"
import { highlight } from "./plugins/highlight"
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
  focusCaretPlacement?: "start" | "end"
  initialValue?: string
  placeholder?: string
  onChange?: (markdown: string) => void
  onEditorReady?: () => void
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

export const TOOLBAR_VISIBLE_STORAGE_KEY = "markdown-editor:toolbar-visible"

const isLegacyToolbarVisibleStorageKey = (key: string) =>
  key.startsWith("markdown-editor:") &&
  key.endsWith(":toolbar-visible") &&
  key !== TOOLBAR_VISIBLE_STORAGE_KEY

const getLegacyToolbarVisibleStorageKeys = (
  storage: Pick<Storage, "length" | "key">,
) => {
  const keys: string[] = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && isLegacyToolbarVisibleStorageKey(key)) {
      keys.push(key)
    }
  }

  return keys
}

export const readToolbarVisiblePreference = (
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem" | "length" | "key"> | undefined,
  fallback: boolean,
) => {
  if (!storage) {
    return fallback
  }

  const sharedValue = storage.getItem(TOOLBAR_VISIBLE_STORAGE_KEY)
  const legacyKeys = getLegacyToolbarVisibleStorageKeys(storage)

  if (sharedValue !== null) {
    for (const key of legacyKeys) {
      storage.removeItem(key)
    }

    return sharedValue !== "false"
  }

  let migratedLegacyValue: string | null = null
  for (const key of legacyKeys) {
    migratedLegacyValue ??= storage.getItem(key)
    storage.removeItem(key)
  }

  if (migratedLegacyValue !== null) {
    storage.setItem(TOOLBAR_VISIBLE_STORAGE_KEY, migratedLegacyValue)
    return migratedLegacyValue !== "false"
  }

  return fallback
}

export const writeToolbarVisiblePreference = (
  storage: Pick<Storage, "setItem" | "removeItem" | "length" | "key"> | undefined,
  value: boolean,
) => {
  if (!storage) {
    return
  }

  storage.setItem(TOOLBAR_VISIBLE_STORAGE_KEY, String(value))
  for (const key of getLegacyToolbarVisibleStorageKeys(storage)) {
    storage.removeItem(key)
  }
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const propsWithDefaults = mergeProps(propDefaults, props)
  const [local, rest] = splitProps(propsWithDefaults, [
    "instanceKey",
    "focusNonce",
    "focusCaretPlacement",
    "initialValue",
    "placeholder",
    "onChange",
    "onEditorReady",
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
  let pendingFocusAfterMount: "start" | "end" | null = null
  let lastHandledFocusNonce: number | undefined
  let disposed = false
  let editorCreateGeneration = 0
  const [activeFormats, setActiveFormats] = createSignal<string[]>([])
  const [disabledFormats, setDisabledFormats] = createSignal<string[]>([])
  const [selectedLinkText, setSelectedLinkText] = createSignal("")
  const [selectionRangeFrom, setSelectionRangeFrom] = createSignal<
    number | undefined
  >(undefined)
  const [selectionRangeTo, setSelectionRangeTo] = createSignal<
    number | undefined
  >(undefined)
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
      () => readToolbarVisiblePreference(localStorage, local.showToolbar),
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
    setSelectedLinkText(linkSelectionState.selectedLinkText)
    setSelectionRangeFrom(linkSelectionState.selectionRangeFrom)
    setSelectionRangeTo(linkSelectionState.selectionRangeTo)
    setSelectedLinkHref(linkSelectionState.selectedLinkHref)
    setSelectedLinkRangeFrom(linkSelectionState.selectedLinkRangeFrom)
    setSelectedLinkRangeTo(linkSelectionState.selectedLinkRangeTo)
  }

  const clearFocusRetryTimeout = () => {
    if (focusRetryTimeout) {
      clearTimeout(focusRetryTimeout)
      focusRetryTimeout = undefined
    }
  }

  const scheduleEditorFocus = (
    caretPlacement: "start" | "end" = local.focusCaretPlacement ?? "start",
  ) => {
    queueMicrotask(() => {
      focusEditor(caretPlacement)
    })

    clearFocusRetryTimeout()
    focusRetryTimeout = setTimeout(() => {
      focusEditor(caretPlacement)
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
          local.onEditorReady?.()
          if (pendingFocusAfterMount === null) {
            return
          }

          const caretPlacement = pendingFocusAfterMount
          pendingFocusAfterMount = null
          scheduleEditorFocus(caretPlacement)
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
      .use(highlight)
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
      writeToolbarVisiblePreference(localStorage, toolbarVisible())
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
      scheduleEditorFocus(local.focusCaretPlacement ?? "start")
      return
    }

    pendingFocusAfterMount = local.focusCaretPlacement ?? "start"
  })

  onCleanup(() => {
    disposed = true
    editorCreateGeneration += 1
    pendingFocusAfterMount = null
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

  const focusEditor = (caretPlacement: "start" | "end" = "start") => {
    if (!editorInstance) {
      return
    }

    editorInstance.action(ctx => {
      const editorView = ctx.get(editorViewCtx)
      if (caretPlacement === "end") {
        const end = editorView.state.doc.content.size
        const transaction = editorView.state.tr.setSelection(
          TextSelection.create(editorView.state.doc, end),
        )
        editorView.dispatch(transaction.scrollIntoView())
      }
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
            selectedLinkText={selectedLinkText()}
            selectionRangeFrom={selectionRangeFrom()}
            selectionRangeTo={selectionRangeTo()}
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
