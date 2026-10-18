export type TwitterWidgets = {
  widgets: {
    createTweet: (
      id: string,
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => Promise<HTMLElement | undefined>
  }
  ready: (callback: (twttr: TwitterWidgets) => void) => void
}

const SCRIPT_ID = "twitter-wjs"
const SCRIPT_SRC = "https://platform.twitter.com/widgets.js"

function twitterGlobal(): TwitterWidgets | undefined {
  const candidate = (globalThis as { twttr?: TwitterWidgets }).twttr
  return candidate?.widgets ? candidate : undefined
}

function ensureTwitterStub(): TwitterWidgets {
  const existing = (globalThis as { twttr?: TwitterWidgets }).twttr
  if (existing?.ready) {
    return existing
  }

  const stub = {
    _e: [] as Array<(twttr: TwitterWidgets) => void>,
    ready(callback: (twttr: TwitterWidgets) => void) {
      const live = twitterGlobal()
      if (live) {
        callback(live)
        return
      }
      this._e.push(callback)
    },
    widgets: undefined as TwitterWidgets["widgets"] | undefined,
  }

  ;(globalThis as { twttr?: unknown }).twttr = stub
  return stub as TwitterWidgets
}

function injectWidgetsScript() {
  if (typeof document === "undefined") {
    return
  }
  if (document.getElementById(SCRIPT_ID)) {
    return
  }
  const script = document.createElement("script")
  script.id = SCRIPT_ID
  script.src = SCRIPT_SRC
  script.async = true
  document.head.appendChild(script)
}

export function loadTwitterWidgets(): Promise<TwitterWidgets> {
  const live = twitterGlobal()
  if (live) {
    return Promise.resolve(live)
  }
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Twitter widgets need a document"))
  }

  const stub = ensureTwitterStub()
  injectWidgetsScript()

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Twitter widgets timed out"))
    }, 15000)

    stub.ready(twttr => {
      window.clearTimeout(timer)
      if (twttr?.widgets) {
        resolve(twttr)
        return
      }
      reject(new Error("Twitter widgets failed to load"))
    })
  })
}

export const X_TWEET_WIDTH_MIN = 250
export const X_TWEET_WIDTH_MAX = 550

/** widgets.js only accepts a whole-pixel width in this inclusive range. */
export function tweetWidgetWidth(containerWidthPx: number): number {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
    return X_TWEET_WIDTH_MAX
  }
  return Math.min(
    X_TWEET_WIDTH_MAX,
    Math.max(X_TWEET_WIDTH_MIN, Math.floor(containerWidthPx)),
  )
}

export function tweetWidgetOptions(containerWidthPx: number) {
  return {
    theme: "dark" as const,
    dnt: true,
    conversation: "none" as const,
    width: tweetWidgetWidth(containerWidthPx),
  }
}
