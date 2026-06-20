import { createEffect, onCleanup, onMount } from "solid-js"
import { useLocation } from "@solidjs/router"
import { useAuth } from "@/context/auth-context"
import {
  ANALYTICS_COLLECT_ENDPOINT,
  ANALYTICS_SITE_ID,
} from "@/lib/analytics/constants"
import { shouldRecordAnalyticsClientSide } from "@/lib/analytics/environment"
import { trackAnalyticsPageview } from "@/lib/analytics/beacon"

export function AnalyticsTracker() {
  const location = useLocation()
  const auth = useAuth()
  let lastTrackedPath: string | null = null

  const shouldTrack = () => {
    if (auth.loading()) {
      return false
    }

    return shouldRecordAnalyticsClientSide(auth.isSuperuser())
  }

  const trackPath = (path: string) => {
    if (!shouldTrack() || path === lastTrackedPath) {
      return
    }

    lastTrackedPath = path
    trackAnalyticsPageview({
      siteId: ANALYTICS_SITE_ID,
      endpoint: ANALYTICS_COLLECT_ENDPOINT,
      path,
    })
  }

  onMount(() => {
    const handleHomeNavChange = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail
      if (detail?.path) {
        trackPath(detail.path)
      }
    }

    window.addEventListener("main-nav-path-changed", handleHomeNavChange)

    onCleanup(() => {
      window.removeEventListener("main-nav-path-changed", handleHomeNavChange)
    })
  })

  createEffect(() => {
    location.pathname
    location.search
    trackPath(`${location.pathname}${location.search}`)
  })

  return null
}
