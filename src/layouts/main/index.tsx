import { createMemo, Show } from "solid-js"
import { useLocation } from "@solidjs/router"
import { AnalyticsTracker } from "@/lib/analytics/tracker"
import { SharedHeadContent } from "@/layouts/shared"
import { MainHeader } from "@/modules/home/components/main-header"
import { SiteDock } from "@/modules/home/components/site-dock"
import { BlipComposerProvider } from "@/modules/blips/context/blip-composer-context"
import { pages } from "@/urls"
import "@/layouts/main/main.css"

export function MainLayout(props) {
  const location = useLocation()
  const showMainChrome = createMemo(() => location.pathname !== pages.login)

  return (
    <BlipComposerProvider>
      <SharedHeadContent />
      <AnalyticsTracker />
      <Show
        when={showMainChrome()}
        fallback={props.children}>
        <div class="site-chrome">
          <MainHeader />
          {props.children}
          <SiteDock />
        </div>
      </Show>
    </BlipComposerProvider>
  )
}
