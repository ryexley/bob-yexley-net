import type { APIEvent } from "@solidjs/start/server"
import { processMedia, resultResponse } from "@/modules/media/server"

// Must run on the Node.js serverless runtime (default for this app on Vercel):
// sharp's native libvips binary is incompatible with the edge runtime.
export async function POST({ request }: APIEvent) {
  try {
    const payload = await request.json()
    return resultResponse(await processMedia(payload))
  } catch (error) {
    console.error("media/process endpoint error:", error)
    return resultResponse({ data: null, error: "Invalid request", status: 400 })
  }
}
