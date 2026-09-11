import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from "solid-js"
import { Icon } from "@/components/icon"
import { ptr } from "@/i18n"
import { clsx as cx } from "@/util"
import { formattingOptions } from "./formatting-config"
import { blurControl, preventControlFocus } from "./prevent-control-focus"
import { mediaLayoutOptionsForType } from "./plugins/media-embed-layout"
import "./toolbar.css"

const layoutTr = ptr("blips.components.blipEditor.media.layout")

const toolbarOptionsForMode = (mode: "text" | "media", mediaType?: string) =>
  mode === "media"
    ? [
        ...formattingOptions.filter(option => option.group === 0),
        ...mediaLayoutOptionsForType(mediaType),
      ]
    : formattingOptions

interface ToolbarProps {
  visible?: boolean
  mode?: "text" | "media"
  mediaType?: string
  activeFormats: string[]
  disabledFormats: string[]
  selectedLinkText: string
  selectionRangeFrom?: number
  selectionRangeTo?: number
  selectedLinkHref: string
  selectedLinkRangeFrom?: number
  selectedLinkRangeTo?: number
  linkEditorRequestNonce: number
  onRequestEditorFocus: () => void
  onFormatApply: (format: string, payload?: any) => void
}

export default function Toolbar(props: ToolbarProps) {
  const [showLinkEditor, setShowLinkEditor] = createSignal(false)
  const [linkHref, setLinkHref] = createSignal("")
  const [linkText, setLinkText] = createSignal("")
  const toolbarMode = createMemo(() => props.mode ?? "text")
  const options = createMemo(() =>
    toolbarOptionsForMode(toolbarMode(), props.mediaType),
  )
  const linkIsActive = createMemo(() => props.activeFormats.includes("link"))
  const pressedFormats = createMemo(() => {
    const formats = [...props.activeFormats]
    if (showLinkEditor()) {
      return formats.includes("link") ? formats : [...formats, "link"]
    }

    return formats
  })
  let previousLinkEditorRequestNonce = untrack(
    () => props.linkEditorRequestNonce,
  )
  let previousLinkEditorOpen = untrack(() => showLinkEditor())
  let linkHrefInputRef: HTMLInputElement | undefined

  const closeLinkEditor = () => {
    setShowLinkEditor(false)
  }

  const openLinkEditor = () => {
    setShowLinkEditor(true)
    setLinkHref(props.selectedLinkHref || "")
    setLinkText(props.selectedLinkText || "")
  }

  const handleLinkClick = () => {
    if (!showLinkEditor()) {
      openLinkEditor()
      return
    }

    handleApplyLink()
  }

  const handleApplyLink = () => {
    const href = linkHref().trim()
    if (!href) {
      return
    }

    props.onFormatApply("link", {
      href,
      text: linkText(),
      rangeFrom: props.selectedLinkRangeFrom,
      rangeTo: props.selectedLinkRangeTo,
    })
    closeLinkEditor()
  }

  const handleRemoveLink = () => {
    props.onFormatApply("link", {
      remove: true,
      rangeFrom: props.selectedLinkRangeFrom,
      rangeTo: props.selectedLinkRangeTo,
    })
    closeLinkEditor()
  }

  const handleLinkEditorKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault()
      closeLinkEditor()
      return
    }

    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
      return
    }

    event.preventDefault()
    handleApplyLink()
  }

  createEffect(() => {
    if (toolbarMode() === "media") {
      closeLinkEditor()
    }
  })

  createEffect(() => {
    const requestNonce = props.linkEditorRequestNonce
    if (requestNonce === previousLinkEditorRequestNonce) {
      return
    }

    previousLinkEditorRequestNonce = requestNonce
    if (toolbarMode() === "media") {
      return
    }

    if (showLinkEditor()) {
      closeLinkEditor()
      return
    }

    openLinkEditor()
  })

  createEffect(() => {
    const isOpen = showLinkEditor()
    if (isOpen && !previousLinkEditorOpen) {
      queueMicrotask(() => {
        linkHrefInputRef?.focus()
        const length = linkHrefInputRef?.value.length ?? 0
        linkHrefInputRef?.setSelectionRange(length, length)
      })
    }

    if (!isOpen && previousLinkEditorOpen) {
      props.onRequestEditorFocus()
    }

    previousLinkEditorOpen = isOpen
  })

  return (
    <div
      role="toolbar"
      aria-label={
        toolbarMode() === "media"
          ? layoutTr("toolbar")
          : "Markdown formatting toolbar"
      }
      aria-orientation="horizontal"
      class={cx("toolbar", {
        visible: props.visible,
        "with-link-editor": showLinkEditor() && toolbarMode() === "text",
      })}>
      <div class="toolbar-content thin-scrollbar">
        <For each={options()}>
          {(option, index) => (
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label={option.ariaLabel}
                aria-pressed={pressedFormats().includes(option.key)}
                disabled={props.disabledFormats.includes(option.key)}
                onClick={() =>
                  option.key === "link"
                    ? handleLinkClick()
                    : option.key === "highlight"
                      ? (closeLinkEditor(),
                        props.onFormatApply(option.key, {
                          rangeFrom: props.selectionRangeFrom,
                          rangeTo: props.selectionRangeTo,
                        }))
                      : (closeLinkEditor(), props.onFormatApply(option.key))
                }
                onPointerDown={preventControlFocus}
                onMouseDown={preventControlFocus}
                onPointerUp={blurControl}
                class={cx("toolbar-button", {
                  "has-label": Boolean(option.label),
                })}>
                <Show
                  when={option.label}
                  fallback={<Icon name={option.icon ?? ""} />}>
                  <span class="toolbar-button-label">{option.label}</span>
                </Show>
              </button>

              {index() < options().length - 1 &&
                option.group !== options()[index() + 1].group && (
                  <div class="toolbar-divider" />
                )}
            </>
          )}
        </For>
      </div>
      <form
        class={cx("toolbar-link-editor", { open: showLinkEditor() })}
        onSubmit={event => {
          event.preventDefault()
          handleApplyLink()
        }}
        aria-hidden={!showLinkEditor()}>
        <div class="toolbar-link-fields">
          <input
            ref={linkHrefInputRef}
            type="url"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
            value={linkHref()}
            class="toolbar-link-input"
            placeholder="https://example.com"
            onInput={e => setLinkHref(e.currentTarget.value)}
            onKeyDown={handleLinkEditorKeyDown}
          />
          <input
            type="text"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
            value={linkText()}
            class="toolbar-link-input"
            placeholder="Link text"
            onInput={e => setLinkText(e.currentTarget.value)}
            onKeyDown={handleLinkEditorKeyDown}
          />
        </div>
        <div class="toolbar-link-actions">
          <button
            type="button"
            tabIndex={-1}
            class="toolbar-link-action"
            aria-label="Apply link"
            onClick={handleApplyLink}
            onMouseDown={preventControlFocus}
            onPointerUp={blurControl}>
            <Icon name="check" />
          </button>
          <Show when={linkIsActive()}>
            <button
              type="button"
              tabIndex={-1}
              class="toolbar-link-action"
              aria-label="Remove link"
              onClick={handleRemoveLink}
              onMouseDown={preventControlFocus}
              onPointerUp={blurControl}>
              <Icon name="link_off" />
            </button>
          </Show>
          <button
            type="button"
            tabIndex={-1}
            class="toolbar-link-action"
            aria-label="Cancel link editing"
            onClick={closeLinkEditor}
            onMouseDown={preventControlFocus}
            onPointerUp={blurControl}>
            <Icon name="close" />
          </button>
        </div>
      </form>
    </div>
  )
}
