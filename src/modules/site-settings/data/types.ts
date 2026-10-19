export type AdminSiteSettings = {
  homeHeroImageIds: string[]
}

export type AdminSiteSettingsQueryResult = {
  authorized: boolean
  settings: AdminSiteSettings | null
  error: string | null
}

export type UpdateHomeHeroImageIdsResult = {
  success: boolean
  data: string[] | null
  error: string | null
}
