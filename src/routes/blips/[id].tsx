import { getBlipGraph } from "@/modules/blips/data"
import { getBlipMediaFor } from "@/modules/media/data/queries"
import { BlipView } from "@/modules/blips/views/blip"

export async function preload({ params }) {
  // Fetch blip graph first to get update IDs
  const graph = await getBlipGraph(params.id)
  
  if (!graph) {
    return
  }
  
  // Get all published update IDs (public visitors only see published updates)
  const publishedUpdateIds = (graph.updates ?? [])
    .filter(update => update.published)
    .map(update => update.id)
  
  // Fetch media for root blip + all published updates for og:image fallback
  const blipIds = [params.id, ...publishedUpdateIds]
  void getBlipMediaFor(blipIds)
}

export default BlipView
