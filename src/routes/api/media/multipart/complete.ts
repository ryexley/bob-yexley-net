import type { APIEvent } from "@solidjs/start/server"
import { completeMultipart, resultResponse } from "@/modules/media/server"

export async function POST({ request }: APIEvent) {
  try {
    const payload = await request.json()
    return resultResponse(await completeMultipart(payload))
  } catch (error) {
    console.error("media/multipart/complete endpoint error:", error)
    return resultResponse({ data: null, error: "Invalid request", status: 400 })
  }
}
