import type { APIEvent } from "@solidjs/start/server"
import { resultResponse, signPart } from "@/modules/media/server"

export async function POST({ request }: APIEvent) {
  try {
    const payload = await request.json()
    return resultResponse(await signPart(payload))
  } catch (error) {
    console.error("media/multipart/sign-part endpoint error:", error)
    return resultResponse({ data: null, error: "Invalid request", status: 400 })
  }
}
