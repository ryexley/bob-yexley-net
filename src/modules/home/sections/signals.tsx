import { createEffect } from "solid-js"
import { createAsync, useNavigate } from "@solidjs/router"
import { Blip as BlipIcon, Icon } from "@/components/icon"
import { PageSection } from "@/modules/home/components/page-section"
import { Blips } from "@/modules/blips/components/blips"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { blipStore, getBlips } from "@/modules/blips/data"
import { isBlipPubliclyVisible } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import "@/modules/blips/views/blips-section-chrome.css"
import "./signals.css"

const tr = ptr("home.pageSections.signals")
const blipsHeading = ptr("blips.views.index")

export function Signals(props) {
  const initialBlips = createAsync(() => getBlips(4))
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth() as any

  const supabase = useSupabase()
  const {
    entities: blips,
    setInitialData,
    // fetchAll,
    // isLoading,
  } = blipStore(supabase.client, {
    limit: 4,
    subscribe: false,
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
    return allBlips.filter(blip => isBlipPubliclyVisible(blip))
  }

  return (
    <PageSection
      ref={props.ref}
      class="signals blips-index"
      {...props}>
      <BlipIcon
        class="blips-index-mark"
        aria-hidden="true"
      />
      <h2 class="blips-page-heading">
        <span class="blips-page-heading-start">
          <span class="blips-page-heading-lead">{blipsHeading("headingLead")}</span>
          <span class="blips-page-heading-mark">{blipsHeading("headingMark")}</span>
        </span>
        <span class="blips-page-heading-tail">{blipsHeading("headingTail")}</span>
      </h2>
      <Blips
        blips={visibleBlips()}
        onView={blipId =>
          navigate(pages.blip(blipId), {
            scroll: true,
            state: { fromBlips: true },
          })
        }
      />
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
