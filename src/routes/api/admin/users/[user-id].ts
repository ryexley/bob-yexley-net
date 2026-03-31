import type { APIEvent } from "@solidjs/start/server"
import { updateAdminUser } from "@/modules/users/data/server"

export async function PATCH({ params, request }: APIEvent) {
  try {
    const payload = await request.json()
    const result = await updateAdminUser(params["user-id"], payload)
    const status = result.success ? 200 : result.error === "Unauthorized" ? 403 : 400

    return new Response(JSON.stringify(result), {
      status,
      headers: {
        "content-type": "application/json",
      },
    })
  } catch (error) {
    console.error("Admin user update endpoint error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: "Unable to save user changes right now.",
        pinWasReset: false,
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      },
    )
  }
}
