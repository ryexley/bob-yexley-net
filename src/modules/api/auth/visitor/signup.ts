import { z } from "zod"
import { getAdminClient } from "@/lib/vendor/supabase/admin"

const visitorSignupSchema = z.object({
  email: z.string().trim().email(),
  pin: z.string().regex(/^\d{6}$/),
  displayName: z.string().trim().min(1).max(80),
})

export type VisitorSignupPayload = z.infer<typeof visitorSignupSchema>

type VisitorSignupResult = {
  success: boolean
  error?: string
}

const DEFAULT_SIGNUP_ERROR = "Unable to create visitor account right now."

const sanitizeSignupError = (message: string | undefined): string => {
  if (!message) {
    return DEFAULT_SIGNUP_ERROR
  }
  if (message === "User already registered") {
    return "An account already exists for this email."
  }
  if (message === "Invalid email address") {
    return "Please provide a valid email address."
  }
  return DEFAULT_SIGNUP_ERROR
}

export async function signUpVisitor(
  payload: VisitorSignupPayload,
): Promise<VisitorSignupResult> {
  const parsed = visitorSignupSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please provide a valid email, 6-digit PIN, and display name.",
    }
  }

  const adminClient = getAdminClient()
  const { email, pin, displayName } = parsed.data

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  })

  if (error) {
    return {
      success: false,
      error: sanitizeSignupError(error.message),
    }
  }

  return {
    success: true,
  }
}
