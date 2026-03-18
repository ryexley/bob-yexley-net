import { createEffect } from "solid-js"
import { createAsync } from "@solidjs/router"
import { Icon } from "@/components/icon"
import { PageSection } from "@/modules/home/components/page-section"
import { Blips } from "@/modules/blips/components/blips"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { blipStore, getBlips } from "@/modules/blips/data"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import "./signals.css"

const tr = ptr("home.pageSections.signals")

export function Signals(props) {
  const initialBlips = createAsync(() => getBlips(4))
  const { isAuthenticated } = useAuth() as any

  const supabase = useSupabase()
  const {
    entities: blips,
    setInitialData,
    // fetchAll,
    // isLoading,
  } = blipStore(supabase.client, {
    limit: 4,
  })

  createEffect(() => {
    const ssrData = initialBlips()

    if (ssrData) {
      setInitialData(ssrData)
    }
  })

  const visibleBlips = () => {
    const allBlips = blips() ?? []
    if (isAuthenticated()) {
      return allBlips
    }
    return allBlips.filter(blip => blip.published)
  }

  return (
    <PageSection
      ref={props.ref}
      class="thoughts signals"
      {...props}>
      <Blips blips={visibleBlips()} />
      <div class="signals-see-more">
        <a
          href={pages.blips}
          class="signals-see-more-link">
          {tr("actions.seeMore")}
          <Icon name="arrow_forward" />
        </a>
      </div>
    </PageSection>
  )
}
