type EditorFocusBridgeOptions = {
  defaultDelayMs: number
  requestEditorFocus: () => void
  coalesceImmediateFocus?: boolean
  proxyRefocusCooldownMs?: number
}

export function createEditorFocusBridge(options: EditorFocusBridgeOptions) {
  let focusProxyRef: HTMLTextAreaElement | undefined
  let focusAfterOpenTimeout: ReturnType<typeof setTimeout> | null = null
  let immediateFocusMicrotaskQueued = false
  let lastProxyActivationAt = 0
  const proxyRefocusCooldownMs = options.proxyRefocusCooldownMs ?? 0
  const shouldCoalesceImmediateFocus = options.coalesceImmediateFocus ?? false

  const setFocusProxyRef = (element: HTMLTextAreaElement) => {
    focusProxyRef = element
  }

  const activateFocusProxy = () => {
    try {
      focusProxyRef?.focus({ preventScroll: true })
    } catch {
      focusProxyRef?.focus()
    }
  }

  const requestImmediateEditorFocus = () => {
    if (!shouldCoalesceImmediateFocus) {
      options.requestEditorFocus()
      return
    }

    if (immediateFocusMicrotaskQueued) {
      return
    }

    immediateFocusMicrotaskQueued = true
    queueMicrotask(() => {
      immediateFocusMicrotaskQueued = false
      options.requestEditorFocus()
    })
  }

  const clearScheduledFocus = () => {
    if (focusAfterOpenTimeout) {
      clearTimeout(focusAfterOpenTimeout)
      focusAfterOpenTimeout = null
    }
  }

  const scheduleFocusAfterOpen = (delay = options.defaultDelayMs) => {
    const now = Date.now()
    if (now - lastProxyActivationAt > proxyRefocusCooldownMs) {
      activateFocusProxy()
      lastProxyActivationAt = now
    }

    requestImmediateEditorFocus()
    clearScheduledFocus()
    focusAfterOpenTimeout = setTimeout(() => {
      options.requestEditorFocus()
      focusAfterOpenTimeout = null
    }, delay)
  }

  return {
    setFocusProxyRef,
    clearScheduledFocus,
    scheduleFocusAfterOpen,
  }
}
