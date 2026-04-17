import { beforeEach, describe, expect, it, vi } from "vitest"
import { updateAdminUser } from "@/modules/users/data/server"

const {
  serverUserId,
  serverUserError,
  selectedProfile,
  selectedProfileError,
  userProfileRow,
  userProfileLookupError,
  userSystemRow,
  userSystemLookupError,
  updatedUserSystemRow,
  userSystemUpdateError,
  existingRole,
  existingRoleError,
  upsertRoleError,
  superuserCount,
  superuserCountError,
  passwordUpdateError,
  authUserEmail,
  authUserError,
} = vi.hoisted(() => ({
  serverUserId: { value: "superuser-1" as string | null },
  serverUserError: { value: null as { message: string } | null },
  selectedProfile: {
    value: {
      role: "superuser",
    } as { role: "superuser" | "admin" | "visitor" } | null,
  },
  selectedProfileError: { value: null as string | null },
  userProfileRow: {
    value: {
      id: "profile-1",
      user_id: "user-2",
      display_name: "Crystal",
      created_at: "2026-03-30T21:01:00.000Z",
    },
  },
  userProfileLookupError: { value: null as { message: string } | null },
  userSystemRow: {
    value: {
      user_profile_id: "profile-1",
      status: "pending",
      trusted: false,
      notes: "  old note  ",
    },
  },
  userSystemLookupError: { value: null as { message: string } | null },
  updatedUserSystemRow: {
    value: {
      user_profile_id: "profile-1",
      status: "active",
      trusted: true,
      notes: "trimmed note",
    },
  },
  userSystemUpdateError: { value: null as { message: string } | null },
  existingRole: { value: "visitor" as "superuser" | "admin" | "visitor" },
  existingRoleError: { value: null as { message: string } | null },
  upsertRoleError: { value: null as { message: string } | null },
  superuserCount: { value: 2 },
  superuserCountError: { value: null as { message: string } | null },
  passwordUpdateError: { value: null as { message: string } | null },
  authUserEmail: { value: "crystal@yexley.net" as string | null },
  authUserError: { value: null as { message: string } | null },
}))

const updateUserById = vi.fn()
const getUserById = vi.fn()
const from = vi.fn()

vi.mock("@/lib/vendor/supabase/server", () => ({
  getServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: serverUserId.value ? { id: serverUserId.value } : null,
        },
        error: serverUserError.value,
      }),
    },
  }),
}))

vi.mock("@/lib/vendor/supabase/user-profile", () => ({
  selectUserProfileRecord: vi.fn(async () => ({
    data: selectedProfile.value,
    error: selectedProfileError.value,
  })),
}))

vi.mock("@/lib/vendor/supabase/admin", () => ({
  getAdminClient: () => ({
    auth: {
      admin: {
        updateUserById,
        getUserById,
      },
    },
    from,
  }),
}))

function createSelectBuilder(table: string, columns: string, options?: { count?: string; head?: boolean }) {
  if (table === "user_roles" && options?.head) {
    return {
      eq: async () => ({
        count: superuserCount.value,
        error: superuserCountError.value,
      }),
    }
  }

  if (table === "user_profile") {
    return {
      eq: (_column: string, value: string) => {
        const row =
          userProfileRow.value && userProfileRow.value.user_id === value
            ? userProfileRow.value
            : null
        return {
          maybeSingle: async () => ({
            data: row,
            error: userProfileLookupError.value,
          }),
        }
      },
    }
  }

  if (table === "user_system") {
    return {
      eq: (_column: string, value: string) => {
        const row =
          userSystemRow.value && userSystemRow.value.user_profile_id === value
            ? userSystemRow.value
            : null
        return {
          maybeSingle: async () => ({
            data: row,
            error: userSystemLookupError.value,
          }),
        }
      },
    }
  }

  if (table === "user_roles") {
    if (columns === "user_id, role") {
      return Promise.resolve({
        data:
          existingRole.value
            ? [{ user_id: userProfileRow.value?.user_id ?? "user-2", role: existingRole.value }]
            : [],
        error: null,
      })
    }

    return {
      eq: (_column: string, value: string) => ({
        maybeSingle: async () => ({
          data:
            existingRole.value && value === (userProfileRow.value?.user_id ?? "user-2")
              ? { role: existingRole.value }
              : null,
          error: existingRoleError.value,
        }),
      }),
    }
  }

  throw new Error(`Unexpected select on ${table}`)
}

function createUpdateBuilder(table: string) {
  if (table !== "user_system") {
    throw new Error(`Unexpected update on ${table}`)
  }

  return {
    eq: () => ({
      select: () => ({
        single: async () => ({
          data: updatedUserSystemRow.value,
          error: userSystemUpdateError.value,
        }),
      }),
    }),
  }
}

beforeEach(() => {
  serverUserId.value = "superuser-1"
  serverUserError.value = null
  selectedProfile.value = { role: "superuser" }
  selectedProfileError.value = null
  userProfileRow.value = {
    id: "profile-1",
    user_id: "user-2",
    display_name: "Crystal",
    created_at: "2026-03-30T21:01:00.000Z",
  }
  userProfileLookupError.value = null
  userSystemRow.value = {
    user_profile_id: "profile-1",
    status: "pending",
    trusted: false,
    notes: "  old note  ",
  }
  userSystemLookupError.value = null
  updatedUserSystemRow.value = {
    user_profile_id: "profile-1",
    status: "active",
    trusted: true,
    notes: "trimmed note",
  }
  userSystemUpdateError.value = null
  existingRole.value = "visitor"
  existingRoleError.value = null
  upsertRoleError.value = null
  superuserCount.value = 2
  superuserCountError.value = null
  passwordUpdateError.value = null
  authUserEmail.value = "crystal@yexley.net"
  authUserError.value = null

  updateUserById.mockReset()
  updateUserById.mockImplementation(async () => ({
    error: passwordUpdateError.value,
  }))
  getUserById.mockReset()
  getUserById.mockImplementation(async () => ({
    data: {
      user: {
        email: authUserEmail.value,
      },
    },
    error: authUserError.value,
  }))
  from.mockReset()
  from.mockImplementation((table: string) => ({
    select: (columns: string, options?: { count?: string; head?: boolean }) =>
      createSelectBuilder(table, columns, options),
    upsert: async () => ({
      error: upsertRoleError.value,
    }),
    update: () => createUpdateBuilder(table),
  }))
})

describe("updateAdminUser", () => {
  it("updates role, trims notes, and forces active status when resetting the PIN", async () => {
    const result = await updateAdminUser("user-2", {
      role: "admin",
      status: "locked",
      notes: "  trimmed note  ",
      pin: "123456",
    })

    expect(result).toEqual({
      success: true,
      data: {
        userId: "user-2",
        profileId: "profile-1",
        role: "admin",
        email: "crystal@yexley.net",
        displayName: "Crystal",
        status: "active",
        notes: "trimmed note",
        trusted: true,
        createdAt: "2026-03-30T21:01:00.000Z",
      },
      error: null,
      pinWasReset: true,
    })
    expect(updateUserById).toHaveBeenCalledWith("user-2", {
      password: "123456",
    })
  })

  it("prevents a superuser from removing their own superuser role", async () => {
    serverUserId.value = "user-2"
    userProfileRow.value = {
      ...userProfileRow.value!,
      user_id: "user-2",
    }
    existingRole.value = "superuser"

    const result = await updateAdminUser("user-2", {
      role: "admin",
      status: "active",
      notes: "",
      pin: "",
    })

    expect(result).toEqual({
      success: false,
      data: null,
      error: "You cannot remove your own superuser role.",
      pinWasReset: false,
    })
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it("prevents demoting the last remaining superuser", async () => {
    existingRole.value = "superuser"
    superuserCount.value = 1

    const result = await updateAdminUser("user-2", {
      role: "admin",
      status: "active",
      notes: "",
      pin: "",
    })

    expect(result).toEqual({
      success: false,
      data: null,
      error: "You cannot remove the last remaining superuser.",
      pinWasReset: false,
    })
    expect(updateUserById).not.toHaveBeenCalled()
  })
})
