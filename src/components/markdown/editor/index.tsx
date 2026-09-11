import {
  createEffect,
  createSignal,
  onCleanup,
  mergeProps,
  splitProps,
  Show,
  untrack,
  type Component,
  type JSX,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  prosePluginsCtx,
  commandsCtx,
} from "@milkdown/core"
import { commonmark } from "@milkdown/preset-commonmark"
import { listener, listenerCtx } from "@milkdown/plugin-listener"
import { emoji } from "@milkdown/plugin-emoji"
import { history } from "@milkdown/prose/history"
import { TextSelection } from "@milkdown/prose/state"
import { clsx as cx } from "@/util"
import { withWindow } from "@/util/browser"
import { debounce } from "@/util/debounce"
import { TIME } from "@/util/enums"
import { Stack } from "@/components/stack"
import { highlight } from "./plugins/highlight"
import { audioEmbed } from "./plugins/audio-embed"
import { mediaEmbed } from "./plugins/media-embed"
import {
  insertMediaEmbedCommand,
  type MediaEmbedInsert,
} from "./plugins/media-embed-editor-behavior"
import { placeholder } from "./plugins/placeholder"
import { applyFormat, getEditorToolbarSnapshot } from "./commands"
import { insertClipboardText } from "./insert-clipboard-text"
import { readClipboardSnapshot } from "@/modules/media/clipboard-snapshot"
import type { EmbedSelection } from "./plugins/media-embed-layout"
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
  onEditorApi?: (api: MarkdownEditorApi | null) => void
  /** Clipboard files from the toolbar Paste action (user-gesture read). */
  onClipboardMedia?: (files: File[]) => void
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
  MetadataPanel?: Component<MarkdownEditorControlsProps>
  metadataPanelVisible?: boolean
  /** Rendered between the editor body and `EditorControls` (stable module component recommended). */
  AboveControls?: Component<Record<string, unknown>>
  aboveControlsProps?: Record<string, unknown>
  /** Bottom chrome. Stable component required; rendered with `Dynamic` so status updates do not remount it. */
  EditorControls?: Component<MarkdownEditorControlsProps>
}

export type MarkdownEditorApi = {
  insertMediaEmbeds: (items: MediaEmbedInsert[]) => void
}

export type MarkdownEditorControlsProps = {
  onToggleToolbar: () => void
  toolbarVisible: boolean
  statusText?: string
  statusIcon?: JSX.Element
  showStatus?: boolean
  statusFading?: boolean
  statusActions?: Component<any>
  statusContext?: any
}

export type MarkdownEditorContentMetrics = {
  characterCount: number
  wordCount: number
  paragraphCount: number
}

export const getMarkdownEditorContentMetrics = (
  markdown: string,
): MarkdownEditorContentMetrics => {
  const normalized = markdown.trim()
  if (!normalized) {
    return {
      characterCount: 0,
      wordCount: 0,
      paragraphCount: 0,
    }
  }

  return {
    characterCount: normalized.length,
    wordCount: normalized.split(/\s+/).filter(Boolean).length,
    paragraphCount: normalized.split(/\n\s*\n/).filter(Boolean).length,
  }
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
  storage:
    | Pick<Storage, "getItem" | "setItem" | "removeItem" | "length" | "key">
    | undefined,
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
  storage:
    | Pick<Storage, "setItem" | "removeItem" | "length" | "key">
    | undefined,
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
    "onEditorApi",
    "onContentMetricsChange",
    "onClipboardMedia",
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
    "MetadataPanel",
    "metadataPanelVisible",
    "AboveControls",
    "aboveControlsProps",
    "EditorControls",
  ])

  let editorRef: HTMLDivElement | undefined
  let editorInstance: Editor | undefined
  let editorKeydownCleanup: (() => void) | undefined
  const editorCallbacks = untrack(() => ({
    onChange: local.onChange,
    onEditorReady: local.onEditorReady,
    onEditorApi: local.onEditorApi,
    onContentMetricsChange: local.onContentMetricsChange,
    onClipboardMedia: local.onClipboardMedia,
  }))
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
  const [toolbarMode, setToolbarMode] = createSignal<"text" | "media">("text")
  const [mediaToolbarType, setMediaToolbarType] = createSignal<
    string | undefined
  >(undefined)
  const [toolbarVisible, setToolbarVisible] = createSignal(
    withWindow(
      () => readToolbarVisiblePreference(localStorage, local.showToolbar),
      () => local.showToolbar,
    ),
  )

  const handleToolbarPaste = async () => {
    // Call read() from the click itself. pointerdown is too early: Safari
    // treats the rest of that tap as dismissing its Paste callout.
    const snapshot = await readClipboardSnapshot()
    if (!editorInstance) {
      return
    }
    if (snapshot.denied) {
      focusEditor()
      return
    }
    if (snapshot.files.length > 0) {
      editorCallbacks.onClipboardMedia?.(snapshot.files)
      return
    }
    if (!snapshot.text) {
      focusEditor()
      return
    }
    editorInstance.action(ctx => {
      insertClipboardText(ctx.get(editorViewCtx), snapshot.text)
    })
    syncToolbarState()
  }

  const handleApplyFormat = (format: string, payload?: any) => {
    if (!editorInstance) {
      return
    }

    if (format === "paste") {
      void handleToolbarPaste()
      return
    }

    applyFormat(editorInstance, format, payload)
    syncToolbarState()
  }

  const syncToolbarState = (selection?: EmbedSelection | null) => {
    if (!editorInstance) {
      return
    }

    const snapshot = getEditorToolbarSnapshot(editorInstance, selection)
    setActiveFormats(snapshot.activeFormats)
    setDisabledFormats(snapshot.disabledFormats)
    setToolbarMode(snapshot.mode)
    setMediaToolbarType(snapshot.mediaType)
    setSelectedLinkText(snapshot.linkSelectionState.selectedLinkText)
    setSelectionRangeFrom(snapshot.linkSelectionState.selectionRangeFrom)
    setSelectionRangeTo(snapshot.linkSelectionState.selectionRangeTo)
    setSelectedLinkHref(snapshot.linkSelectionState.selectedLinkHref)
    setSelectedLinkRangeFrom(snapshot.linkSelectionState.selectedLinkRangeFrom)
    setSelectedLinkRangeTo(snapshot.linkSelectionState.selectedLinkRangeTo)
  }

  const clearFocusRetryTimeout = () => {
    if (focusRetryTimeout) {
      clearTimeout(focusRetryTimeout)
      focusRetryTimeout = undefined
    }
  }

  createEffect(() => {
    editorCallbacks.onChange = local.onChange
    editorCallbacks.onEditorReady = local.onEditorReady
    editorCallbacks.onEditorApi = local.onEditorApi
    editorCallbacks.onContentMetricsChange = local.onContentMetricsChange
    editorCallbacks.onClipboardMedia = local.onClipboardMedia
  })

  const emitContentMetrics = debounce((markdown: string) => {
    editorCallbacks.onContentMetricsChange?.(
      getMarkdownEditorContentMetrics(markdown),
    )
  }, TIME.TWO_POINT_FIVE_SECONDS)

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
        // oxlint-disable-next-line solid/reactivity
        ctx.get(listenerCtx).mounted(() => {
          editorCallbacks.onEditorReady?.()
          emitContentMetrics(initialValue)
          if (pendingFocusAfterMount === null) {
            return
          }

          const caretPlacement = pendingFocusAfterMount
          pendingFocusAfterMount = null
          scheduleEditorFocus(caretPlacement)
        })
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          editorCallbacks.onChange?.(markdown)
          emitContentMetrics(markdown)
        })
        ctx.get(listenerCtx).selectionUpdated((_ctx, selection) => {
          syncToolbarState(selection)
        })
        ctx.get(listenerCtx).updated(() => {
          syncToolbarState()
        })
      })
      .use(commonmark)
      .use(highlight)
      .use(audioEmbed)
      .use(mediaEmbed)
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
        editorCallbacks.onEditorApi?.({
          insertMediaEmbeds: items => {
            if (!editorInstance || items.length === 0) {
              return
            }
            editorInstance.action(ctx => {
              ctx.get(commandsCtx).call(insertMediaEmbedCommand.key, items)
            })
          },
        })
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
              if (toolbarMode() === "media") {
                return
              }

              if (!toolbarVisible()) {
                setToolbarVisible(true)
              }

              syncToolbarState()
              setLinkEditorRequestNonce(prev => prev + 1)
            }
          }

          editorDom.addEventListener("keydown", handleKeyDown)
          // oxlint-disable-next-line solid/reactivity
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
    // oxlint-disable-next-line solid/reactivity
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
    emitContentMetrics.cancel()
    editorKeydownCleanup?.()
    editorKeydownCleanup = undefined
    editorCallbacks.onEditorApi?.(null)
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

  const EditorToolbar = () => (
    <Toolbar
      visible={toolbarVisible()}
      mode={toolbarMode()}
      mediaType={mediaToolbarType()}
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
  )

  return (
    <div class={cx("markdown-editor", local.class)}>
      <Show when={local.Header}>
        <Dynamic component={local.Header} />
      </Show>
      <Stack gap="0.5rem">
        <div
          class={cx("editor-container", {
            "has-alternate-body": Boolean(local.MetadataPanel),
            "alternate-body-visible": local.metadataPanelVisible === true,
          })}
          {...rest}>
          <Show
            when={local.MetadataPanel}
            fallback={
              <>
                <EditorToolbar />
                <div
                  ref={editorRef}
                  data-placeholder={local.placeholder}
                />
              </>
            }>
            {MetadataPanel => (
              <div class="editor-body-carousel">
                <div class="editor-body-track">
                  <div class="editor-body-pane editor-body-pane-editor">
                    <EditorToolbar />
                    <div
                      ref={editorRef}
                      data-placeholder={local.placeholder}
                    />
                  </div>
                  <div class="editor-body-pane editor-body-pane-alternate">
                    <Dynamic
                      component={MetadataPanel()}
                      onToggleToolbar={handleToggleToolbar}
                      toolbarVisible={toolbarVisible()}
                      statusText={local.statusText}
                      statusIcon={local.statusIcon}
                      showStatus={local.showStatus}
                      statusFading={local.statusFading}
                      statusActions={local.statusActions}
                      statusContext={local.statusContext}
                    />
                  </div>
                </div>
              </div>
            )}
          </Show>
        </div>
        <Show when={local.AboveControls != null}>
          <Dynamic
            component={local.AboveControls!}
            {...(local.aboveControlsProps ?? {})}
          />
        </Show>
        <Show when={local.EditorControls != null}>
          <Dynamic
            component={local.EditorControls!}
            onToggleToolbar={handleToggleToolbar}
            toolbarVisible={toolbarVisible()}
            statusText={local.statusText}
            statusIcon={local.statusIcon}
            showStatus={local.showStatus}
            statusFading={local.statusFading}
            statusActions={local.statusActions}
            statusContext={local.statusContext}
          />
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
