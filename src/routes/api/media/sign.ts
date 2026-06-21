import type { APIEvent } from "@solidjs/start/server"
import { resultResponse, signUpload } from "@/modules/media/server"

export async function POST({ request }: APIEvent) {
  try {
    const payload = await request.json()
    return resultResponse(await signUpload(payload))
  } catch (error) {
    console.error("media/sign endpoint error:", error)
    return resultResponse({ data: null, error: "Invalid request", status: 400 })
  }
}
