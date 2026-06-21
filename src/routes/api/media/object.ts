import type { APIEvent } from "@solidjs/start/server"
import { deleteObject, resultResponse } from "@/modules/media/server"

export async function DELETE({ request }: APIEvent) {
  try {
    const payload = await request.json()
    return resultResponse(await deleteObject(payload))
  } catch (error) {
    console.error("media/object endpoint error:", error)
    return resultResponse({ data: null, error: "Invalid request", status: 400 })
  }
}
