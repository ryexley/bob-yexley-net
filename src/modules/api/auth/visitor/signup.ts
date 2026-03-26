import { z } from "zod"
import { VISITOR_AUTH_ERROR, type VisitorAuthErrorCode } from "@/lib/auth/visitor-auth-errors"
import { getAdminClient } from "@/lib/vendor/supabase/admin"

const visitorSignupSchema = z.object({
  email: z.string().trim().email(),
  pin: z.string().regex(/^\d{6}$/),
  displayName: z.string().trim().min(1).max(80),
})

export type VisitorSignupPayload = z.infer<typeof visitorSignupSchema>

type VisitorSignupResult = {
  success: boolean
  error?: VisitorAuthErrorCode
}

const sanitizeSignupError = (
  message: string | undefined,
): VisitorAuthErrorCode => {
  if (!message) {
    return VISITOR_AUTH_ERROR.SIGNUP_UNAVAILABLE
  }
  if (message === "User already registered") {
    return VISITOR_AUTH_ERROR.SIGNUP_EMAIL_EXISTS
  }
  if (message === "Invalid email address") {
    return VISITOR_AUTH_ERROR.SIGNUP_INVALID_EMAIL
  }
  return VISITOR_AUTH_ERROR.SIGNUP_UNAVAILABLE
}

export async function signUpVisitor(
  payload: VisitorSignupPayload,
): Promise<VisitorSignupResult> {
  const parsed = visitorSignupSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      error: VISITOR_AUTH_ERROR.VALIDATION_SIGNUP_REQUIRED,
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
