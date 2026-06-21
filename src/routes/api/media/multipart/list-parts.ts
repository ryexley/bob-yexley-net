import type { APIEvent } from "@solidjs/start/server"
import { listParts, resultResponse } from "@/modules/media/server"

export async function POST({ request }: APIEvent) {
  try {
    const payload = await request.json()
    return resultResponse(await listParts(payload))
  } catch (error) {
    console.error("media/multipart/list-parts endpoint error:", error)
    return resultResponse({ data: null, error: "Invalid request", status: 400 })
  }
}
