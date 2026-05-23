import { createAsync, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo } from "solid-js"
import { Icon, LoadingSpinner } from "@/components/icon"
import { useAuth } from "@/context/auth-context"
import { RequiresSuperUser } from "@/modules/auth/components/requires-role"
import { getAdminCollections } from "@/modules/scripture-collections/data/queries"
import { getAdminReferences } from "@/modules/scripture-references/data/queries"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import "./index.css"

const tr = ptr("scripture.views.index")

export function ScriptureHomeView() {
  const navigate = useNavigate()
  const auth = useAuth()
  const adminCollectionsQuery = createAsync(() => getAdminCollections())
  const adminReferencesQuery = createAsync(() => getAdminReferences())

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
    const collectionsResult = adminCollectionsQuery()
    const referencesResult = adminReferencesQuery()
    if (
      auth.loading() ||
      !auth.isSuperuser() ||
      collectionsResult === undefined ||
      referencesResult === undefined
    ) {
      return
    }

    if (!collectionsResult.authorized || !referencesResult.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const isReady = createMemo(
    () =>
      adminCollectionsQuery() !== undefined &&
      adminReferencesQuery() !== undefined &&
      auth.isSuperuser(),
  )
  const collectionCount = createMemo(
    () => adminCollectionsQuery()?.collections.length ?? 0,
  )
  const referenceCount = createMemo(
    () => adminReferencesQuery()?.references.length ?? 0,
  )

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="scripture-home-view">
        <a
          href={pages.admin}
          class="scripture-home-view-back-link">
          <Icon name="arrow_back" />
          {tr("actions.backToAdmin")}
        </a>
        <div class="scripture-home-view-shell">
          <div class="scripture-home-view-header">
            <h1 class="scripture-home-view-title">{tr("title")}</h1>
            <p class="scripture-home-view-subtitle">{tr("subtitle")}</p>
          </div>

          <RequiresSuperUser
            fallback={
              <div class="scripture-home-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            {isReady() ? (
              <div class="scripture-home-view-grid">
                <a
                  href={pages.scriptureCollections}
                  class="scripture-home-view-card">
                  <div class="scripture-home-view-card-header">
                    <Icon
                      name="menu_book"
                      class="scripture-home-view-card-icon"
                    />
                    <h2 class="scripture-home-view-card-title">
                      {tr("cards.collections.title")}
                    </h2>
                  </div>
                  <div class="scripture-home-view-card-copy">
                    <p class="scripture-home-view-card-description">
                      {tr("cards.collections.description")}
                    </p>
                  </div>
                  <div class="scripture-home-view-card-bubbles">
                    <span class="scripture-home-view-status-bubble">
                      {tr("cards.collections.total", {
                        count: collectionCount(),
                      })}
                    </span>
                  </div>
                </a>
                <a
                  href={pages.scriptureReferences}
                  class="scripture-home-view-card">
                  <div class="scripture-home-view-card-header">
                    <Icon
                      name="bookmark"
                      class="scripture-home-view-card-icon"
                    />
                    <h2 class="scripture-home-view-card-title">
                      {tr("cards.references.title")}
                    </h2>
                  </div>
                  <div class="scripture-home-view-card-copy">
                    <p class="scripture-home-view-card-description">
                      {tr("cards.references.description")}
                    </p>
                  </div>
                  <div class="scripture-home-view-card-bubbles">
                    <span class="scripture-home-view-status-bubble">
                      {tr("cards.references.total", {
                        count: referenceCount(),
                      })}
                    </span>
                  </div>
                </a>
              </div>
            ) : (
              <div class="scripture-home-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            )}
          </RequiresSuperUser>
        </div>
      </main>
    </>
  )
}

export default ScriptureHomeView
