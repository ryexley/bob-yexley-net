import type { AdminUserUpdateInput, AdminUserUpdateResult } from "./types"

export async function updateAdminUserRecord(
  userId: string,
  payload: AdminUserUpdateInput,
): Promise<AdminUserUpdateResult> {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const result = (await response.json().catch(() => null)) as AdminUserUpdateResult | null

    if (!response.ok || !result) {
      return {
        success: false,
        data: null,
        error: result?.error ?? "Unable to save user changes right now.",
        pinWasReset: false,
      }
    }

    return result
  } catch (error) {
    console.error("Update admin user request failed:", error)
    return {
      success: false,
      data: null,
      error: "Unable to save user changes right now.",
      pinWasReset: false,
    }
  }
}
