import type { APIEvent } from "@solidjs/start/server"

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
    const event = String(body?.event ?? "unknown")
    const outcome = String(body?.outcome ?? "unknown")
    const reason = body?.reason ? String(body.reason) : undefined
    const email = maskEmail(body?.email ? String(body.email) : undefined)

    console.info("[visitor-auth][telemetry]", {
      event,
      outcome,
      reason,
      email,
      at: new Date().toISOString(),
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("Visitor auth telemetry endpoint error:", error)
    return new Response(null, { status: 204 })
  }
}
