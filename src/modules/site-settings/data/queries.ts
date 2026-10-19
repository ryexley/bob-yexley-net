import { query } from "@solidjs/router"
import type { AdminSiteSettingsQueryResult } from "./types"

export const getHomeHeroImageIds = query(async (): Promise<string[]> => {
  "use server"

  const { loadHomeHeroImageIds } = await import("./server")
  return loadHomeHeroImageIds()
}, "home-hero-image-ids")

export const getAdminSiteSettings = query(
  async (): Promise<AdminSiteSettingsQueryResult> => {
    "use server"

    const { loadAdminSiteSettings } = await import("./server")
    return loadAdminSiteSettings()
  },
  "admin-site-settings",
)
