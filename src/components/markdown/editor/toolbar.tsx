import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { ToggleGroup } from "@kobalte/core"
import { Icon } from "@/components/icon"
import { clsx as cx } from "@/util"
import { formattingOptions } from "./formatting-config"
import "./toolbar.css"

interface ToolbarProps {
  visible?: boolean
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
  const linkIsActive = createMemo(() => props.activeFormats.includes("link"))
  const pressedFormats = createMemo(() => {
    const formats = [...props.activeFormats]
    if (showLinkEditor()) {
      return formats.includes("link") ? formats : [...formats, "link"]
    }

    return formats
  })
  let previousLinkEditorRequestNonce = props.linkEditorRequestNonce
  let previousLinkEditorOpen = showLinkEditor()
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

  createEffect(() => {
    const requestNonce = props.linkEditorRequestNonce
    if (requestNonce === previousLinkEditorRequestNonce) {
      return
    }

    previousLinkEditorRequestNonce = requestNonce
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
      aria-label="Markdown formatting toolbar"
      aria-orientation="horizontal"
      class={cx("toolbar", {
        visible: props.visible,
        "with-link-editor": showLinkEditor(),
      })}>
      <ToggleGroup.Root
        multiple
        value={pressedFormats()}
        class="toolbar-content thin-scrollbar"
        aria-orientation="horizontal">
        <For each={formattingOptions}>
          {(option, index) => (
            <>
              <ToggleGroup.Item
                value={option.key}
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
                // Preserve editor focus/selection so commands apply correctly.
                onMouseDown={e => e.preventDefault()}
                class="toolbar-button">
                <Icon name={option.icon} />
              </ToggleGroup.Item>

              {/* Add divider if next item is in a different group */}
              {index() < formattingOptions.length - 1 &&
                option.group !== formattingOptions[index() + 1].group && (
                  <div class="toolbar-divider" />
                )}
            </>
          )}
        </For>
      </ToggleGroup.Root>
      <div
        class={cx("toolbar-link-editor", { open: showLinkEditor() })}
        onKeyDown={event => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "k"
          ) {
            event.preventDefault()
            closeLinkEditor()
            return
          }

          if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
            return
          }

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
          />
        </div>
        <div class="toolbar-link-actions">
          <button
            type="button"
            class="toolbar-link-action"
            aria-label="Apply link"
            onClick={handleApplyLink}
            onMouseDown={e => e.preventDefault()}>
            <Icon name="check" />
          </button>
          <Show when={linkIsActive()}>
            <button
              type="button"
              class="toolbar-link-action"
              aria-label="Remove link"
              onClick={handleRemoveLink}
              onMouseDown={e => e.preventDefault()}>
              <Icon name="link_off" />
            </button>
          </Show>
          <button
            type="button"
            class="toolbar-link-action"
            aria-label="Cancel link editing"
            onClick={closeLinkEditor}
            onMouseDown={e => e.preventDefault()}>
            <Icon name="close" />
          </button>
        </div>
      </div>
    </div>
  )
}
