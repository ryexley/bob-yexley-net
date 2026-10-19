import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  loadAdminSiteSettings,
  loadHomeHeroImageIds,
  updateHomeHeroImageIds,
} from "@/modules/site-settings/data/server"
import { DEFAULT_HOME_HERO_IMAGE_IDS } from "@/modules/site-settings/home-hero-images"

const {
  serverUserId,
  selectedProfile,
  settingValue,
  selectError,
  upsertError,
} = vi.hoisted(() => ({
  serverUserId: { value: "superuser-1" as string | null },
  selectedProfile: {
    value: { role: "superuser" } as {
      role: "superuser" | "admin" | "visitor"
    } | null,
  },
  settingValue: {
    value: [
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ] as unknown,
  },
  selectError: { value: null as { message: string } | null },
  upsertError: { value: null as { message: string } | null },
}))

const from = vi.fn()

vi.mock("@/lib/vendor/supabase/server", () => ({
  getServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: serverUserId.value ? { id: serverUserId.value } : null,
        },
        error: null,
      }),
    },
    from,
  }),
}))

vi.mock("@/lib/vendor/supabase/user-profile", () => ({
  selectUserProfileRecord: vi.fn(async () => ({
    data: selectedProfile.value,
    error: null,
  })),
}))

vi.mock("@/lib/vendor/supabase/admin", () => ({
  getAdminClient: () => ({
    from,
  }),
}))

const createSelectBuilder = () => ({
  eq: () => ({
    maybeSingle: async () => ({
      data: selectError.value ? null : { value: settingValue.value },
      error: selectError.value,
    }),
  }),
})

const createUpsertBuilder = (payload: { value: unknown }) => ({
  select: () => ({
    single: async () => {
      if (!upsertError.value) {
        settingValue.value = payload.value
      }

      return {
        data: upsertError.value ? null : { value: settingValue.value },
        error: upsertError.value,
      }
    },
  }),
})

describe("site settings server", () => {
  beforeEach(() => {
    serverUserId.value = "superuser-1"
    selectedProfile.value = { role: "superuser" }
    settingValue.value = [
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ]
    selectError.value = null
    upsertError.value = null
    from.mockReset()
    from.mockImplementation(() => ({
      select: () => createSelectBuilder(),
      upsert: (payload: { value: unknown }) => createUpsertBuilder(payload),
    }))
  })

  it("returns stored hero image ids for the public home page", async () => {
    await expect(loadHomeHeroImageIds()).resolves.toEqual([
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ])
  })

  it("falls back to the hardcoded hero images when the setting cannot be read", async () => {
    selectError.value = { message: "relation does not exist" }

    await expect(loadHomeHeroImageIds()).resolves.toEqual([
      ...DEFAULT_HOME_HERO_IMAGE_IDS,
    ])
  })

  it("loads admin settings for a superuser", async () => {
    const result = await loadAdminSiteSettings()

    expect(result).toEqual({
      authorized: true,
      settings: {
        homeHeroImageIds: [
          "green-forest-near-mountain-2z2CGEB7FIk",
          "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
        ],
      },
      error: null,
    })
  })

  it("rejects admin settings for a visitor", async () => {
    selectedProfile.value = { role: "visitor" }

    await expect(loadAdminSiteSettings()).resolves.toEqual({
      authorized: false,
      settings: null,
      error: null,
    })
  })

  it("saves a normalized hero image list", async () => {
    const result = await updateHomeHeroImageIds([
      "https://unsplash.com/photos/green-forest-near-mountain-2z2CGEB7FIk",
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ])

    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ])
  })

  it("rejects saving hero images when the caller is not a superuser", async () => {
    selectedProfile.value = { role: "admin" }

    await expect(
      updateHomeHeroImageIds(["green-forest-near-mountain-2z2CGEB7FIk"]),
    ).resolves.toEqual({
      success: false,
      data: null,
      error: "Unauthorized",
    })
  })

  it("rejects an empty hero image list", async () => {
    await expect(updateHomeHeroImageIds([])).resolves.toMatchObject({
      success: false,
      data: null,
    })
  })
})
