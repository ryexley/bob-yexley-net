import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearActiveTextInputSession,
  createEditorFocusBridge,
} from "@/modules/blips/components/editor-focus-bridge"

describe("clearActiveTextInputSession", () => {
  let activeElement:
    | ({
        blur?: () => void
      } & Partial<HTMLElement>)
    | null
  let animationFrameCallback: FrameRequestCallback | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    activeElement = null
    animationFrameCallback = undefined
    vi.spyOn(document, "activeElement", "get").mockImplementation(
      () => activeElement as Element | null,
    )
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      animationFrameCallback = callback
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("blurs the active element immediately and repeats cleanup for the proxy", () => {
    const activeBlur = vi.fn(() => {
      activeElement = null
    })
    const proxyBlur = vi.fn()
    activeElement = { blur: activeBlur }
    const focusProxyRef = { blur: proxyBlur } as unknown as HTMLTextAreaElement

    clearActiveTextInputSession("editor.close", {
      focusProxyRef,
      followupDelayMs: 120,
    })

    expect(activeBlur).toHaveBeenCalledTimes(1)
    expect(proxyBlur).toHaveBeenCalledTimes(1)

    animationFrameCallback?.(0)
    expect(activeBlur).toHaveBeenCalledTimes(1)
    expect(proxyBlur).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(120)
    expect(activeBlur).toHaveBeenCalledTimes(1)
    expect(proxyBlur).toHaveBeenCalledTimes(3)
  })

  it("cancels the deferred cleanup passes", () => {
    const activeBlur = vi.fn(() => {
      activeElement = null
    })
    const proxyBlur = vi.fn()
    activeElement = { blur: activeBlur }
    const focusProxyRef = { blur: proxyBlur } as unknown as HTMLTextAreaElement

    const cleanup = clearActiveTextInputSession("editor.close", {
      focusProxyRef,
      followupDelayMs: 120,
    })

    expect(activeBlur).toHaveBeenCalledTimes(1)
    expect(proxyBlur).toHaveBeenCalledTimes(1)

    cleanup.cancel()
    animationFrameCallback?.(0)
    vi.advanceTimersByTime(120)

    expect(proxyBlur).toHaveBeenCalledTimes(1)
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1)
  })
})

describe("createEditorFocusBridge", () => {
  let activeElement:
    | ({
        blur?: () => void
      } & Partial<HTMLElement>)
    | null
  let animationFrameCallback: FrameRequestCallback | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    activeElement = null
    animationFrameCallback = undefined
    vi.spyOn(document, "activeElement", "get").mockImplementation(
      () => activeElement as Element | null,
    )
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      animationFrameCallback = callback
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("focuses the proxy and requests editor focus immediately and after the delay", async () => {
    const requestEditorFocus = vi.fn()
    const proxyFocus = vi.fn()
    const bridge = createEditorFocusBridge({
      defaultDelayMs: 75,
      requestEditorFocus,
      coalesceImmediateFocus: true,
    })

    bridge.setFocusProxyRef({ focus: proxyFocus } as unknown as HTMLTextAreaElement)
    bridge.scheduleFocusAfterOpen()

    expect(proxyFocus).toHaveBeenCalledTimes(1)
    expect(requestEditorFocus).toHaveBeenCalledTimes(0)

    await Promise.resolve()
    expect(requestEditorFocus).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(75)
    expect(requestEditorFocus).toHaveBeenCalledTimes(2)
  })

  it("skips focus work when auto focus is disabled", async () => {
    const requestEditorFocus = vi.fn()
    const proxyFocus = vi.fn()
    const bridge = createEditorFocusBridge({
      defaultDelayMs: 75,
      requestEditorFocus,
      coalesceImmediateFocus: true,
      shouldAutoFocusOnOpen: () => false,
    })

    bridge.setFocusProxyRef({ focus: proxyFocus } as unknown as HTMLTextAreaElement)
    bridge.scheduleFocusAfterOpen()

    await Promise.resolve()
    vi.advanceTimersByTime(75)

    expect(proxyFocus).not.toHaveBeenCalled()
    expect(requestEditorFocus).not.toHaveBeenCalled()
  })

  it("cancels pending text-input cleanup when focus is rescheduled", async () => {
    const requestEditorFocus = vi.fn()
    const activeBlur = vi.fn(() => {
      activeElement = null
    })
    const proxyBlur = vi.fn()
    const proxyFocus = vi.fn()
    const focusProxyRef = {
      blur: proxyBlur,
      focus: proxyFocus,
    } as unknown as HTMLTextAreaElement
    activeElement = { blur: activeBlur }

    const bridge = createEditorFocusBridge({
      defaultDelayMs: 50,
      requestEditorFocus,
      coalesceImmediateFocus: true,
    })

    bridge.setFocusProxyRef(focusProxyRef)
    bridge.clearTextInputSession("editor.close")

    expect(activeBlur).toHaveBeenCalledTimes(1)
    expect(proxyBlur).toHaveBeenCalledTimes(1)

    bridge.scheduleFocusAfterOpen()

    await Promise.resolve()
    animationFrameCallback?.(0)
    vi.advanceTimersByTime(120)

    expect(proxyFocus).toHaveBeenCalledTimes(1)
    expect(proxyBlur).toHaveBeenCalledTimes(1)
    expect(requestEditorFocus).toHaveBeenCalledTimes(2)
  })
})
