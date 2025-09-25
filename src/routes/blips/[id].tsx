import { getBlip } from "@/modules/blips/data"
import { BlipView } from "@/modules/blips/views/blip"

export function preload({ params }) {
  return getBlip(params.id)
}

export default BlipView
