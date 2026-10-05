import type { APIEvent } from "@solidjs/start/server"
import { resultResponse } from "@/modules/media/server"
import { reprocessFailedMedia } from "@/modules/media/reprocess"

// Admin-only backfill of image variants for `processing_status = 'failed'`
// rows. Node runtime (sharp). Each call handles one small batch; the admin UI
// loops until `remaining` stops shrinking.
export async function POST({ request }: APIEvent) {
  let payload: unknown = {}
  try {
    const text = await request.text()
    payload = text ? JSON.parse(text) : {}
  } catch {
    return resultResponse({ data: null, error: "Invalid request", status: 400 })
  }
  return resultResponse(await reprocessFailedMedia(payload))
}
