type EditorFocusBridgeOptions = {
  defaultDelayMs: number
  requestEditorFocus: () => void
  coalesceImmediateFocus?: boolean
  proxyRefocusCooldownMs?: number
  shouldAutoFocusOnOpen?: () => boolean
  shouldUseFocusProxy?: () => boolean
}

type ClearActiveTextInputSessionOptions = {
  focusProxyRef?: HTMLTextAreaElement
  followupDelayMs?: number
}

type ActiveTextInputSessionCleanupHandle = {
  cancel: () => void
}

export function clearActiveTextInputSession(
  reason: string,
  options: ClearActiveTextInputSessionOptions = {},
): ActiveTextInputSessionCleanupHandle {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      cancel: () => {},
    }
  }

  const followupDelayMs = options.followupDelayMs ?? 120
  let cancelled = false
  let animationFrameId: number | null = null
  let timeoutId: number | null = null
  const blurTargets = () => {
    if (
      cancelled ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return
    }

    const activeElement = document.activeElement as
      | (HTMLElement & { blur?: () => void })
      | null

    if (activeElement?.blur) {
      activeElement.blur()
    }

    if (options.focusProxyRef && options.focusProxyRef !== activeElement) {
      options.focusProxyRef.blur()
    }
  }

  blurTargets()

  animationFrameId = window.requestAnimationFrame(() => {
    if (cancelled) {
      return
    }

    blurTargets()
  })

  timeoutId = window.setTimeout(() => {
    if (cancelled) {
      return
    }

    blurTargets()
  }, followupDelayMs)

  return {
    cancel: () => {
      if (cancelled) {
        return
      }

      cancelled = true
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    },
  }
}

export function createEditorFocusBridge(options: EditorFocusBridgeOptions) {
  let focusProxyRef: HTMLTextAreaElement | undefined
  let focusAfterOpenTimeout: ReturnType<typeof setTimeout> | null = null
  let textInputSessionCleanupHandle: ActiveTextInputSessionCleanupHandle | null = null
  let immediateFocusMicrotaskQueued = false
  let lastProxyActivationAt = 0
  const proxyRefocusCooldownMs = options.proxyRefocusCooldownMs ?? 0
  const shouldCoalesceImmediateFocus = options.coalesceImmediateFocus ?? false
  const shouldAutoFocusOnOpen = options.shouldAutoFocusOnOpen ?? (() => true)
  const shouldUseFocusProxy = options.shouldUseFocusProxy ?? (() => true)

  const setFocusProxyRef = (element: HTMLTextAreaElement) => {
    focusProxyRef = element
  }

  const activateFocusProxy = () => {
    if (!shouldUseFocusProxy()) {
      return
    }

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

  const cancelTextInputSessionCleanup = () => {
    if (textInputSessionCleanupHandle) {
      textInputSessionCleanupHandle.cancel()
      textInputSessionCleanupHandle = null
    }
  }

  const scheduleFocusAfterOpen = (delay = options.defaultDelayMs) => {
    const now = Date.now()
    if (!shouldAutoFocusOnOpen()) {
      clearScheduledFocus()
      return
    }

    cancelTextInputSessionCleanup()
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

  const clearTextInputSession = (reason: string) => {
    clearScheduledFocus()
    cancelTextInputSessionCleanup()
    textInputSessionCleanupHandle = clearActiveTextInputSession(reason, {
      focusProxyRef,
    })
  }

  return {
    setFocusProxyRef,
    cancelTextInputSessionCleanup,
    clearScheduledFocus,
    clearTextInputSession,
    scheduleFocusAfterOpen,
  }
}
