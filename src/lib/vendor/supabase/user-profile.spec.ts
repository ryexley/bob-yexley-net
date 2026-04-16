import { describe, expect, it } from "vitest"
import {
  buildUserProfile,
  selectUserProfileRecord,
  type AppRole,
  type UserProfileRecord,
  type VisitorStatus,
} from "@/lib/vendor/supabase/user-profile"

type MockQueryResult = {
  data: unknown
  error: { code?: string; message?: string } | null
}

type MockSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<MockQueryResult>
      }
      maybeSingle: () => Promise<MockQueryResult>
    }
  }
}

const createSupabaseMock = (results: Record<string, MockQueryResult>): MockSupabase =>
  ({
    from: (table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, _value: string) => ({
          maybeSingle: async () => results[table] ?? { data: null, error: null },
        }),
        maybeSingle: async () => results[table] ?? { data: null, error: null },
      }),
    }),
  }) as MockSupabase

describe("user-profile", () => {
  it("reads the combined profile from view_user when available", async () => {
    const supabase = createSupabaseMock({
      view_user: {
        data: {
          user_id: "user-1",
          role: "admin" satisfies AppRole,
          role_created_at: "2025-01-01T00:00:00.000Z",
          role_updated_at: "2025-01-02T00:00:00.000Z",
          visitor_id: "visitor-1",
          visitor_display_name: "Bob",
          visitor_status: "active" satisfies VisitorStatus,
          visitor_failed_login_attempts: 0,
          visitor_notes: "ok",
          visitor_created_at: "2025-01-01T00:00:00.000Z",
        },
        error: null,
      },
    })

    const result = await selectUserProfileRecord(supabase as never, "user-1")

    expect(result).toEqual({
      data: {
        userId: "user-1",
        role: "admin",
        roleCreatedAt: "2025-01-01T00:00:00.000Z",
        roleUpdatedAt: "2025-01-02T00:00:00.000Z",
        visitorId: "visitor-1",
        visitorDisplayName: "Bob",
        visitorStatus: "active",
        visitorFailedLoginAttempts: 0,
        visitorNotes: "ok",
        visitorTrusted: null,
        visitorAvatarSeed: null,
        visitorAvatarVersion: null,
        visitorCreatedAt: "2025-01-01T00:00:00.000Z",
      },
      error: null,
    })
  })

  it("falls back to tables and infers visitor role when view is missing", async () => {
    const supabase = createSupabaseMock({
      view_user: {
        data: null,
        error: { code: "42P01", message: "relation \"view_user\" does not exist" },
      },
      user_roles: {
        data: null,
        error: null,
      },
      visitors: {
        data: {
          id: "visitor-2",
          display_name: "Sue",
          status: "pending" satisfies VisitorStatus,
          failed_login_attempts: 1,
          notes: null,
          created_at: "2025-02-01T00:00:00.000Z",
        },
        error: null,
      },
    })

    const result = await selectUserProfileRecord(supabase as never, "user-2")

    expect(result).toEqual({
      data: {
        userId: "user-2",
        role: "visitor",
        roleCreatedAt: null,
        roleUpdatedAt: null,
        visitorId: "visitor-2",
        visitorDisplayName: "Sue",
        visitorStatus: "pending",
        visitorFailedLoginAttempts: 1,
        visitorNotes: null,
        visitorTrusted: null,
        visitorAvatarSeed: null,
        visitorAvatarVersion: null,
        visitorCreatedAt: "2025-02-01T00:00:00.000Z",
      },
      error: null,
    })
  })

  it("builds the public user profile shape from a record", () => {
    const record: UserProfileRecord = {
      userId: "user-3",
      role: "superuser",
      roleCreatedAt: "2025-01-01T00:00:00.000Z",
      roleUpdatedAt: "2025-01-02T00:00:00.000Z",
      visitorId: "visitor-3",
      visitorDisplayName: "Admin",
      visitorStatus: "active",
      visitorFailedLoginAttempts: 0,
      visitorNotes: "internal",
      visitorTrusted: true,
      visitorAvatarSeed: "seed-3",
      visitorAvatarVersion: 1,
      visitorCreatedAt: "2025-01-03T00:00:00.000Z",
    }

    expect(
      buildUserProfile(record, {
        id: "user-3",
        email: "admin@example.com",
      }),
    ).toEqual({
      user: {
        id: "user-3",
        email: "admin@example.com",
      },
      role: "superuser",
      roleCreatedAt: "2025-01-01T00:00:00.000Z",
      roleUpdatedAt: "2025-01-02T00:00:00.000Z",
      visitor: {
        id: "visitor-3",
        displayName: "Admin",
        status: "active",
        failedLoginAttempts: 0,
        notes: "internal",
        trusted: true,
        avatarSeed: "seed-3",
        avatarVersion: 1,
        createdAt: "2025-01-03T00:00:00.000Z",
      },
    })
  })
})
