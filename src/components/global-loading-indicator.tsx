import { createEffect, createSignal, onCleanup } from "solid-js"
import { useIsRouting } from "@solidjs/router"
import { ptr } from "@/i18n"
import { TIME } from "@/util/enums"
import "./global-loading-indicator.css"

const trLoading = ptr("shared.components.globalLoadingIndicator")
const TRICKLE_MS = TIME.QUARTER_SECOND
const MIN_VISIBLE_MS = TIME.HALF_SECOND
const COMPLETE_MS = 350
const HOLD_MS = TIME.QUARTER_SECOND
const FADE_MS = 300

export function GlobalLoadingIndicator() {
  const isRouting = useIsRouting()
  return <TopLoadingBar active={isRouting()} />
}

type TopLoadingBarProps = {
  active: boolean
  incrementInterval?: number
  waitingTime?: number
  minVisibleTime?: number
}

export function TopLoadingBar(props: TopLoadingBarProps) {
  const [progress, setProgress] = createSignal(0)
  const [opacity, setOpacity] = createSignal(0)
  let started = false
  let startedAt = 0
  let trickleTimer: ReturnType<typeof setInterval> | undefined
  let finishTimer: ReturnType<typeof setTimeout> | undefined

  const clearTimers = () => {
    if (trickleTimer) {
      clearInterval(trickleTimer)
      trickleTimer = undefined
    }
    if (finishTimer) {
      clearTimeout(finishTimer)
      finishTimer = undefined
    }
  }

  const start = () => {
    if (finishTimer) {
      clearTimeout(finishTimer)
      finishTimer = undefined
    }

    setOpacity(1)
    if (!started) {
      started = true
      startedAt = Date.now()
      setProgress(current => Math.max(current, 12))
    }

    if (trickleTimer) {
      return
    }

    trickleTimer = setInterval(() => {
      setProgress(current => (current < 90 ? current + Math.random() * 8 : current))
    }, props.incrementInterval ?? TRICKLE_MS)
  }

  const finish = () => {
    if (trickleTimer) {
      clearInterval(trickleTimer)
      trickleTimer = undefined
    }

    setProgress(100)
    setOpacity(1)
    finishTimer = setTimeout(() => {
      setOpacity(0)
      finishTimer = setTimeout(() => {
        setProgress(0)
        started = false
        finishTimer = undefined
      }, FADE_MS)
    }, COMPLETE_MS + (props.waitingTime ?? HOLD_MS))
  }

  const complete = () => {
    if (!started) {
      return
    }

    const remaining = Math.max(
      0,
      (props.minVisibleTime ?? MIN_VISIBLE_MS) - (Date.now() - startedAt),
    )
    if (trickleTimer && remaining === 0) {
      clearInterval(trickleTimer)
      trickleTimer = undefined
    }

    finishTimer = setTimeout(finish, remaining)
  }

  createEffect(() => {
    if (props.active) {
      start()
      return
    }

    complete()
  })

  onCleanup(clearTimers)

  return (
    <div class="global-loading-indicator-track">
      <div
        class="global-loading-indicator"
        role="progressbar"
        aria-label={trLoading("ariaLabel")}
        aria-hidden={opacity() === 0 ? true : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress())}
        style={{
          opacity: opacity(),
          transform: `scaleX(${progress() / 100})`,
        }}
      />
      <div
        class="global-loading-indicator__shadow"
        style={{
          opacity: opacity(),
          left: `calc(${progress()}% - 2.5%)`,
        }}
      />
    </div>
  )
}
