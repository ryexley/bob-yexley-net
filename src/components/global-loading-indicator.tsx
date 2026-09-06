import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useIsRouting } from "@solidjs/router"
import { useAuth } from "@/context/auth-context"
import { ptr } from "@/i18n"
import { TIME } from "@/util/enums"
import "./global-loading-indicator.css"

const trLoading = ptr("shared.components.globalLoadingIndicator")
const INCREMENT_INTERVAL_MS = TIME.QUARTER_SECOND
const MIN_VISIBLE_MS = TIME.HALF_SECOND
const COMPLETE_HOLD_MS = TIME.QUARTER_SECOND
const FADE_MS = 300

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min + 1) + min

const randomStartProgress = () => Math.floor(randomBetween(10, 20))

const [pageLoadCount, setPageLoadCount] = createSignal(0)

export function useGlobalPageLoading(isLoading: () => boolean) {
  createEffect(() => {
    if (!isLoading()) {
      return
    }

    setPageLoadCount(count => count + 1)
    onCleanup(() => {
      setPageLoadCount(count => Math.max(0, count - 1))
    })
  })
}

type TopLoadingBarProps = {
  active: boolean
  waitingTime?: number
  minVisibleTime?: number
  incrementInterval?: number
}

export function TopLoadingBar(props: TopLoadingBarProps) {
  const waitingTime = () => props.waitingTime ?? COMPLETE_HOLD_MS
  const minVisibleTime = () => props.minVisibleTime ?? MIN_VISIBLE_MS
  const incrementInterval = () => props.incrementInterval ?? INCREMENT_INTERVAL_MS
  const [progress, setProgress] = createSignal(0)
  const [opacity, setOpacity] = createSignal(0)
  let started = false
  let startedAt = 0
  let incrementTimer: ReturnType<typeof setInterval> | undefined
  let completeTimer: ReturnType<typeof setTimeout> | undefined
  let fadeTimer: ReturnType<typeof setTimeout> | undefined

  const clearTimers = () => {
    if (incrementTimer) {
      clearInterval(incrementTimer)
      incrementTimer = undefined
    }
    if (completeTimer) {
      clearTimeout(completeTimer)
      completeTimer = undefined
    }
    if (fadeTimer) {
      clearTimeout(fadeTimer)
      fadeTimer = undefined
    }
  }

  const resetBar = () => {
    setProgress(0)
    setOpacity(0)
  }

  const trickle = () => {
    setProgress(current => {
      const increment = randomBetween(
        Math.min(8, (95 - current) / 6),
        Math.min(14, (95 - current) / 3),
      )
      const nextProgress = current + increment
      return nextProgress < 95 ? nextProgress : current
    })
  }

  const start = () => {
    clearTimers()
    started = true
    startedAt = Date.now()
    setProgress(randomStartProgress())
    setOpacity(1)
    incrementTimer = setInterval(trickle, incrementInterval())
  }

  const finishComplete = () => {
    clearTimers()
    setProgress(100)
    setOpacity(1)
    completeTimer = setTimeout(() => {
      setOpacity(0)
      fadeTimer = setTimeout(() => {
        resetBar()
        started = false
      }, FADE_MS)
    }, waitingTime())
  }

  const complete = () => {
    const remaining = Math.max(0, minVisibleTime() - (Date.now() - startedAt))
    if (remaining === 0) {
      finishComplete()
      return
    }

    completeTimer = setTimeout(finishComplete, remaining)
  }

  createEffect(() => {
    if (props.active) {
      start()
      return
    }

    if (started) {
      complete()
    }
  })

  onCleanup(clearTimers)

  return (
    <div
      class="global-loading-indicator-track"
      style={{
        "--loading-progress": `${progress()}%`,
        "--loading-opacity": String(opacity()),
      }}>
      <div
        class="global-loading-indicator"
        role="progressbar"
        aria-label={trLoading("ariaLabel")}
        aria-hidden={opacity() === 0 ? true : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress())}>
        <div class="global-loading-indicator__shadow" />
      </div>
    </div>
  )
}

export function GlobalLoadingIndicator() {
  const auth = useAuth()
  const isRouting = useIsRouting()
  const active = createMemo(
    () => auth.loading() || auth.busy() || isRouting() || pageLoadCount() > 0,
  )

  return <TopLoadingBar active={active()} />
}
