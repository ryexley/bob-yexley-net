import { createEffect, onCleanup, type Accessor } from "solid-js"

type EditorMobileViewportRuntimeOptions = {
  isOpen: Accessor<boolean>
  setKeyboardInsetPx: (value: number) => void
  setViewportTopPx?: (value: number) => void
}

const EDITOR_VIEWPORT_LOCKED_CONTENT =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
const EDITOR_VIEWPORT_DEFAULT_CONTENT = "width=device-width, initial-scale=1.0"

const getKeyboardInsetPx = () => {
  if (typeof window === "undefined") {
    return 0
  }

  const viewport = window.visualViewport
  if (!viewport) {
    return 0
  }

  return Math.max(
    0,
    Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)),
  )
}

const getViewportTopPx = () => {
  if (typeof window === "undefined") {
    return 0
  }

  const viewport = window.visualViewport
  if (!viewport) {
    return 0
  }

  return Math.max(0, Math.round(viewport.offsetTop))
}

export function useEditorMobileViewportRuntime(
  options: EditorMobileViewportRuntimeOptions,
) {
  let windowScrollYOnOpen = 0

  createEffect(() => {
    const isOpen = options.isOpen()

    if (typeof document === "undefined" || typeof window === "undefined") {
      return
    }

    /* eslint-disable-next-line quotes */
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    if (!viewportMeta) {
      return
    }

    if (isOpen) {
      windowScrollYOnOpen = window.scrollY
      viewportMeta.setAttribute("content", EDITOR_VIEWPORT_LOCKED_CONTENT)
      return
    }

    viewportMeta.setAttribute("content", EDITOR_VIEWPORT_DEFAULT_CONTENT)
    window.scrollTo(0, windowScrollYOnOpen)
  })

  createEffect(() => {
    if (!options.isOpen()) {
      options.setKeyboardInsetPx(0)
      options.setViewportTopPx?.(0)
      return
    }

    if (typeof window === "undefined") {
      return
    }

    const updateViewportMetrics = () => {
      const keyboardInsetPx = getKeyboardInsetPx()
      const viewportTopPx = getViewportTopPx()
      options.setKeyboardInsetPx(keyboardInsetPx)
      options.setViewportTopPx?.(viewportTopPx)
    }

    updateViewportMetrics()
    const viewport = window.visualViewport
    viewport?.addEventListener("resize", updateViewportMetrics)
    viewport?.addEventListener("scroll", updateViewportMetrics)
    window.addEventListener("resize", updateViewportMetrics)

    onCleanup(() => {
      viewport?.removeEventListener("resize", updateViewportMetrics)
      viewport?.removeEventListener("scroll", updateViewportMetrics)
      window.removeEventListener("resize", updateViewportMetrics)
    })
  })

  onCleanup(() => {
    if (typeof document === "undefined") {
      return
    }

    /* eslint-disable-next-line quotes */
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    viewportMeta?.setAttribute("content", EDITOR_VIEWPORT_DEFAULT_CONTENT)
  })
}
