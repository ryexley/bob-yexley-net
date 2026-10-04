import { getBlipGraph } from "@/modules/blips/data"
import { getBlipMediaFor } from "@/modules/media/data/queries"
import { BlipView } from "@/modules/blips/views/blip"

export function preload({ params }) {
  // Both queries run and are available during SSR
  void getBlipGraph(params.id)
  void getBlipMediaFor([params.id])
}

export default BlipView
