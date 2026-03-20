import { getBlipGraph } from "@/modules/blips/data"
import { BlipView } from "@/modules/blips/views/blip"

export function preload({ params }) {
  return getBlipGraph(params.id)
}

export default BlipView
