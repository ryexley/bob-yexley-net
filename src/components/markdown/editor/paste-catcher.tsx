/**
 * A paste target for phones.
 *
 * iOS offers no way to ask for the system edit menu, and the async clipboard
 * API is a dead end there: `navigator.clipboard` is absent outside a secure
 * context, and when it does exist `read()` puts up a callout that any stray tap
 * cancels. The one dependable route is the gesture users already know — touch
 * and hold an editable region, tap Paste — which fires a real `paste` event.
 *
 * Tapping inside the editor is unreliable because iOS only raises the menu when
 * the tap lands on the caret. This is instead a small, empty region that is
 * focused for the user, so the caret has nowhere else to be and the gesture
 * lands every time.
 *
 * The default paste is deliberately *not* prevented: on iOS a pasted image
 * exists only as the `<img src="blob:…">` WebKit writes into the focused
 * element, so the insert has to happen before there is anything to harvest.
 */
import { createSignal, onCleanup, onMount } from "solid-js"
import { Icon } from "@/components/icon"
import { clsx as cx } from "@/util"
import { clipboardMediaFiles } from "@/modules/media/file-validation"
import {
  harvestMediaFromElement,
  harvestMediaFromHtml,
  readClipboardHtml,
} from "@/modules/media/clipboard-media-harvest"
import "./paste-catcher.css"

const CATCHER_SELECTOR = "[data-paste-catcher]"

/** WebKit inserts on the next turn; the later tries cover slower decodes. */
const HARVEST_DELAYS_MS = [0, 60, 180]

export type PasteCatcherHandle = {
  /** Call synchronously from the tap: iOS rejects a later focus() change. */
  open: () => void
  close: () => void
}

type PasteCatcherProps = {
  title: string
  hint: string
  cancelLabel: string
  onFiles: (files: File[]) => void
  onText: (text: string) => void
  /** Nothing came back — hand control to the editor again. */
  onDismiss: () => void
  onHandle: (handle: PasteCatcherHandle) => void
}

/**
 * True when a paste originated in the catcher. Composer-level paste handlers
 * must ignore those: the catcher needs the default insert to run.
 */
export function isPasteCatcherEvent(event: Event): boolean {
  const target = event.target
  return target instanceof Element && target.closest(CATCHER_SELECTOR) != null
}

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

export function PasteCatcher(props: PasteCatcherProps) {
  const [open, setOpen] = createSignal(false)
  let rootRef: HTMLDivElement | undefined
  let regionRef: HTMLDivElement | undefined
  let settling = false

  const clearRegion = () => {
    if (regionRef) {
      regionRef.textContent = ""
    }
  }

  const close = () => {
    settling = false
    setOpen(false)
    clearRegion()
  }

  onMount(() =>
    props.onHandle({
      open: () => {
        clearRegion()
        setOpen(true)
        // Solid batches the signal write until this handler returns, but iOS
        // only starts an editing session on a visible element and only during
        // the gesture. Apply the same class the signal is about to apply, so
        // the region is expanded before focus() runs; the signal then keeps it
        // in sync and removes it on close.
        rootRef?.classList.add("open")
        regionRef?.focus()
      },
      close,
    }),
  )

  const finish = (files: File[], text: string) => {
    close()
    if (files.length > 0) {
      props.onFiles(files)
      return
    }
    if (text.trim()) {
      props.onText(text)
      return
    }
    props.onDismiss()
  }

  const settle = async (html: string, text: string) => {
    const fromHtml = await harvestMediaFromHtml(html)
    if (fromHtml.length > 0) {
      finish(fromHtml, "")
      return
    }

    for (const delay of HARVEST_DELAYS_MS) {
      await wait(delay)
      if (!settling || !regionRef) {
        return
      }
      const fromDom = await harvestMediaFromElement(regionRef)
      if (fromDom.length > 0) {
        finish(fromDom, "")
        return
      }
      // Text landed instead of an image, so no decode is pending.
      if (regionRef.textContent?.trim()) {
        break
      }
    }

    finish([], text || (regionRef?.textContent ?? ""))
  }

  const handlePaste = (event: ClipboardEvent) => {
    const html = readClipboardHtml(event.clipboardData)
    const text = event.clipboardData?.getData("text/plain") ?? ""
    const files = clipboardMediaFiles(event.clipboardData)

    if (files.length > 0) {
      event.preventDefault()
      finish(files, "")
      return
    }

    settling = true
    void settle(html, text)
  }

  const dismiss = () => {
    close()
    props.onDismiss()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      dismiss()
    }
  }

  onCleanup(close)

  return (
    <div
      ref={rootRef}
      class={cx("paste-catcher", { open: open() })}
      aria-hidden={!open()}>
      <div class="sheet">
        <p class="prompt">
          <Icon name="content_paste" />
          <span>{props.title}</span>
          <button
            type="button"
            class="cancel"
            onClick={dismiss}>
            {props.cancelLabel}
          </button>
        </p>
        <div
          ref={regionRef}
          data-paste-catcher=""
          class="region"
          contentEditable
          role="textbox"
          tabIndex={-1}
          aria-label={props.title}
          data-hint={props.hint}
          autocapitalize="none"
          autocorrect="off"
          spellcheck={false}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}
