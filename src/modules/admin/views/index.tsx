import { createAsync, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, For } from "solid-js"
import { Icon, LoadingSpinner } from "@/components/icon"
import { useAuth } from "@/context/auth-context"
import { RequiresSuperUser } from "@/modules/auth/components/requires-role"
import { getAdminCollections } from "@/modules/scripture-collections/data/queries"
import { getAdminReferences } from "@/modules/scripture-references/data/queries"
import { getAdminUsers } from "@/modules/users/data/queries"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import "./index.css"

const tr = ptr("admin.views.index")

export function AdminHomeView() {
  const navigate = useNavigate()
  const auth = useAuth()
  const adminUsersQuery = createAsync(() => getAdminUsers())
  const adminCollectionsQuery = createAsync(() => getAdminCollections())
  const adminReferencesQuery = createAsync(() => getAdminReferences())
  const counts = createMemo(() => {
    const users = adminUsersQuery()?.users ?? []

    return {
      pending: users.filter(user => user.status === "pending").length,
      active: users.filter(user => user.status === "active").length,
      locked: users.filter(user => user.status === "locked").length,
      total: users.length,
    }
  })
  const statusBubbles = createMemo(() =>
    [
      {
        key: "locked",
        count: counts().locked,
      },
      {
        key: "pending",
        count: counts().pending,
      },
      {
        key: "active",
        count: counts().active,
      },
    ].filter(item => item.count > 0),
  )

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
    const result = adminUsersQuery()
    if (auth.loading() || !auth.isSuperuser() || result === undefined) {
      return
    }

    if (!result.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const isReady = createMemo(
    () =>
      adminUsersQuery() !== undefined &&
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
      <main class="admin-home-view">
        <div class="shell">
          <div class="header">
            <h1 class="title">{tr("title")}</h1>
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
                <a
                  href={pages.users}
                  class="card">
                  <div class="card-header">
                    <Icon
                      name="group"
                      class="icon"
                    />
                    <h2 class="card-title">{tr("cards.users.title")}</h2>
                  </div>
                  <div class="copy">
                    <p class="description">
                      {tr("cards.users.description")}
                    </p>
                  </div>
                  <div class="bubbles">
                    <For each={statusBubbles()}>
                      {item => (
                        <span
                          class="bubble"
                          data-status={item.key}>
                          {tr(`cards.users.statuses.${item.key}`, {
                            count: item.count,
                          })}
                        </span>
                      )}
                    </For>
                  </div>
                </a>
                <div class="card scripture-card">
                  <a
                    href={pages.scripture}
                    class="stretched-link"
                    aria-label={tr("cards.scripture.openLabel")}
                  />
                  <div class="card-header">
                    <Icon
                      name="menu_book"
                      class="icon"
                    />
                    <h2 class="card-title">{tr("cards.scripture.title")}</h2>
                  </div>
                  <div class="copy">
                    <p class="description">
                      {tr("cards.scripture.description")}
                    </p>
                  </div>
                  <div class="bubbles">
                    <a
                      href={pages.scriptureCollections}
                      class="bubble"
                      data-status="info">
                      {tr("cards.scripture.collections", {
                        count: collectionCount(),
                      })}
                    </a>
                    <a
                      href={pages.scriptureReferences}
                      class="bubble"
                      data-status="info">
                      {tr("cards.scripture.references", {
                        count: referenceCount(),
                      })}
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div class="loading-state">
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

export default AdminHomeView
