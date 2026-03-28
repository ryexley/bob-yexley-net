import type { APIEvent } from "@solidjs/start/server"
import { signUpVisitor } from "@/modules/api/auth/visitor/signup"

const maskEmail = (email: string | undefined): string => {
  if (!email) {
    return "unknown"
  }

  const normalized = email.trim().toLowerCase()
  const [local, domain] = normalized.split("@")
  if (!local || !domain) {
    return normalized
  }

  const safeLocal =
    local.length <= 2
      ? `${local.slice(0, 1)}*`
      : `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 1))}`

  return `${safeLocal}@${domain}`
}

export async function POST({ request }: APIEvent) {
  try {
    const body = await request.json()
    const email = body?.email ? String(body.email) : undefined
    const result = await signUpVisitor({
      email,
      pin: body?.pin,
      displayName: body?.displayName,
    })

    if (!result.success) {
      console.info("[visitor-auth][signup]", {
        outcome: "failure",
        email: maskEmail(email),
        reason: result.error || "unknown",
        at: new Date().toISOString(),
      })
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        },
      )
    }

    console.info("[visitor-auth][signup]", {
      outcome: "success",
      email: maskEmail(email),
      at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Visitor signup endpoint error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to create visitor account right now.",
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
