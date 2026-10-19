import { z } from "zod"
import { getAdminClient } from "@/lib/vendor/supabase/admin"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import {
  DEFAULT_HOME_HERO_IMAGE_IDS,
  HOME_HERO_IMAGES_SETTING_KEY,
  MAX_HOME_HERO_IMAGES,
  normalizeHeroImageIds,
  parseHeroImageIds,
} from "@/modules/site-settings/home-hero-images"
import type {
  AdminSiteSettingsQueryResult,
  UpdateHomeHeroImageIdsResult,
} from "./types"

type SiteSettingRow = {
  key: string
  value: unknown
  updated_at: string
  updated_by: string | null
}

type CurrentAdminRequestContext = {
  authorized: boolean
  currentUserId: string | null
}

const homeHeroImageIdsSchema = z
  .array(z.string())
  .min(1)
  .max(MAX_HOME_HERO_IMAGES)

const fallbackHeroImageIds = (): string[] => [...DEFAULT_HOME_HERO_IMAGE_IDS]

const resolveHeroImageIds = (value: unknown): string[] =>
  parseHeroImageIds(value) ?? fallbackHeroImageIds()

async function getCurrentSuperuserContext(): Promise<CurrentAdminRequestContext> {
  const supabase = await getServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    return {
      authorized: false,
      currentUserId: null,
    }
  }

  const { data: profile, error: profileError } = await selectUserProfileRecord(
    supabase,
    user.id,
  )

  if (profileError || !profile) {
    return {
      authorized: false,
      currentUserId: user.id,
    }
  }

  return {
    authorized: profile.role === "superuser",
    currentUserId: user.id,
  }
}

async function readHeroImageIdsValue(): Promise<unknown> {
  const supabase = await getServerClient()
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", HOME_HERO_IMAGES_SETTING_KEY)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as Pick<SiteSettingRow, "value"> | null)?.value
}

export async function loadHomeHeroImageIds(): Promise<string[]> {
  try {
    return resolveHeroImageIds(await readHeroImageIdsValue())
  } catch (error) {
    console.error("Failed to load home hero image ids:", error)
    return fallbackHeroImageIds()
  }
}

export async function loadAdminSiteSettings(): Promise<AdminSiteSettingsQueryResult> {
  const access = await getCurrentSuperuserContext()
  if (!access.authorized) {
    return {
      authorized: false,
      settings: null,
      error: null,
    }
  }

  try {
    return {
      authorized: true,
      settings: {
        homeHeroImageIds: await loadHomeHeroImageIds(),
      },
      error: null,
    }
  } catch (error) {
    console.error("Failed to load admin site settings:", error)
    return {
      authorized: true,
      settings: {
        homeHeroImageIds: fallbackHeroImageIds(),
      },
      error: "Unable to load site settings right now.",
    }
  }
}

export async function updateHomeHeroImageIds(
  payload: unknown,
): Promise<UpdateHomeHeroImageIdsResult> {
  const access = await getCurrentSuperuserContext()
  if (!access.authorized) {
    return {
      success: false,
      data: null,
      error: "Unauthorized",
    }
  }

  const parsed = homeHeroImageIdsSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      data: null,
      error: "Please provide between 1 and 24 Unsplash photo slugs.",
    }
  }

  const imageIds = normalizeHeroImageIds(parsed.data)
  if (imageIds.length === 0) {
    return {
      success: false,
      data: null,
      error: "Please provide at least one valid Unsplash photo slug or URL.",
    }
  }

  if (imageIds.length > MAX_HOME_HERO_IMAGES) {
    return {
      success: false,
      data: null,
      error: "Please provide between 1 and 24 Unsplash photo slugs.",
    }
  }

  try {
    const adminClient = getAdminClient()
    const { data, error } = await adminClient
      .from("site_settings")
      .upsert({
        key: HOME_HERO_IMAGES_SETTING_KEY,
        value: imageIds,
        updated_by: access.currentUserId,
      })
      .select("value")
      .single()

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }

    return {
      success: true,
      data: resolveHeroImageIds(
        (data as Pick<SiteSettingRow, "value"> | null)?.value,
      ),
      error: null,
    }
  } catch (error) {
    console.error("Failed to update home hero image ids:", error)
    return {
      success: false,
      data: null,
      error: "Unable to save home page images right now.",
    }
  }
}
