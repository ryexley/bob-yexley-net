import { createAsync, revalidate, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal } from "solid-js"
import { Icon, LoadingSpinner } from "@/components/icon"
import { useAuth } from "@/context/auth-context"
import { RequiresSuperUser } from "@/modules/auth/components/requires-role"
import { HomeHeroImagesDrawer } from "@/modules/site-settings/components/home-hero-images-drawer"
import {
  getAdminSiteSettings,
  getHomeHeroImageIds,
} from "@/modules/site-settings/data/queries"
import { DEFAULT_HOME_HERO_IMAGE_IDS } from "@/modules/site-settings/home-hero-images"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import "./index.css"

const tr = ptr("siteSettings.views.index")

export function SiteSettingsView() {
  const navigate = useNavigate()
  const auth = useAuth()
  const adminSettingsQuery = createAsync(() => getAdminSiteSettings())
  const [homeHeroImageIds, setHomeHeroImageIds] = createSignal<string[]>([
    ...DEFAULT_HOME_HERO_IMAGE_IDS,
  ])
  const [homeHeroImagesOpen, setHomeHeroImagesOpen] = createSignal(false)

  createEffect(() => {
    const result = adminSettingsQuery()
    if (!result?.settings) {
      return
    }

    setHomeHeroImageIds(result.settings.homeHeroImageIds)
  })

  createEffect(() => {
    if (auth.loading()) {
      return
    }

    if (!auth.isSuperuser()) {
      navigate(auth.isAuthenticated() ? pages.home : pages.login, {
        replace: true,
      })
    }
  })

  createEffect(() => {
    const result = adminSettingsQuery()
    if (auth.loading() || !auth.isSuperuser() || result === undefined) {
      return
    }

    if (!result.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const isReady = createMemo(
    () => adminSettingsQuery() !== undefined && auth.isSuperuser(),
  )
  const heroImageCount = createMemo(() => homeHeroImageIds().length)

  const handleHeroImagesSaved = async (imageIds: string[]) => {
    setHomeHeroImageIds(imageIds)
    await revalidate([getAdminSiteSettings.key, getHomeHeroImageIds.key])
  }

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="site-settings-view">
        <a
          href={pages.admin}
          class="back-link">
          <Icon name="arrowLeft" />
          {tr("actions.backToAdmin")}
        </a>
        <div class="shell">
          <div class="header">
            <h1 class="title">{tr("title")}</h1>
            <p class="subtitle">{tr("subtitle")}</p>
          </div>

          <RequiresSuperUser
            fallback={
              <div class="loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            {isReady() ? (
              <div class="grid">
                <button
                  type="button"
                  class="card"
                  onClick={() => setHomeHeroImagesOpen(true)}>
                  <div class="card-header">
                    <Icon
                      name="images"
                      class="icon"
                    />
                    <h2 class="card-title">
                      {tr("cards.homeHeroImages.title")}
                    </h2>
                  </div>
                  <div class="copy">
                    <p class="description">
                      {tr("cards.homeHeroImages.description")}
                    </p>
                  </div>
                  <div class="bubbles">
                    <span
                      class="bubble"
                      data-status="info">
                      {tr("cards.homeHeroImages.total", {
                        count: heroImageCount(),
                      })}
                    </span>
                  </div>
                </button>
              </div>
            ) : (
              <div class="loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            )}
          </RequiresSuperUser>
        </div>

        <HomeHeroImagesDrawer
          open={homeHeroImagesOpen()}
          imageIds={homeHeroImageIds()}
          onOpenChange={setHomeHeroImagesOpen}
          onSaved={ids => {
            void handleHeroImagesSaved(ids)
          }}
        />
      </main>
    </>
  )
}

export default SiteSettingsView
