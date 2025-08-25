import { CallUsLink } from "@/components/call-us-link"
import { Drawer } from "@/components/drawer"
import { MapLink } from "@/components/map-link"
import { Stack } from "@/components/stack"
import { tr } from "@/i18n"
import { external } from "@/urls"

const contactInfoPanelStyles =
  "w-full max-w-[calc(100vw-2rem)] !mx-auto p-4 !min-h-[8rem] sm:max-w-[30rem] left-1/2 -translate-x-1/2 border rounded-tl-xl rounded-tr-xl border-b-0 mx-4 bg-[var(--colors-mono-02)]"
const toggleStyles =
  "fixed bottom-0 left-1/2 z-50 flex h-10 w-14 items-center justify-center border border-t border-[var(--colors-mono-03)] border-b-0 rounded-tl-lg rounded-tr-lg rounded-bl-none rounded-br-none p-2 backdrop-blur-md transform -translate-x-1/2 !rotate-0"
const toggleIconStyles = "!text-[var(--colors-info)] text-3xl"

export function ContactInfoPanel() {
  const shopAddress = {
    line1: tr("org.address.line1"),
    city: tr("org.address.city"),
    state: tr("org.address.state"),
    postalCode: tr("org.address.postalCode"),
  }
  const mapLinkUrl = external.mapUrl(shopAddress)

  return (
    <Drawer
      position="bottom"
      showCloseButton={false}
      toggleIcon="id_card"
      toggleClass={toggleStyles}
      toggleIconClass={toggleIconStyles}
      class={contactInfoPanelStyles}
      contentClass="!overflow-visible">
      <div class="flex flex-row gap-12 align-stretch justify-center">
        <Stack
          align="end"
          fullWidth={false}
          gap="0">
          <span class="text-sm">
            {tr("marketing.home.components.contactInfoPanel.callUsLinkLabel")}
          </span>
          <CallUsLink>{tr("org.phoneNumber")}</CallUsLink>
        </Stack>
        <Stack gap="0">
          <span class="text-sm">
            {tr("marketing.home.components.contactInfoPanel.mapLinkLabel")}
          </span>
          <MapLink
            url={mapLinkUrl}
            role="button">
            <Stack gap="0">
              <span>{shopAddress.line1}</span>
              <span>{`${shopAddress.city}, ${shopAddress.state} ${shopAddress.postalCode}`}</span>
            </Stack>
          </MapLink>
        </Stack>
      </div>
    </Drawer>
  )
}
