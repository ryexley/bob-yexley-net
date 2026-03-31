import { createAsync, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, For } from "solid-js"
import { Icon, LoadingSpinner } from "@/components/icon"
import { useAuth } from "@/context/auth-context"
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

  const isReady = createMemo(() => adminUsersQuery() !== undefined && auth.isSuperuser())

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="admin-home-view">
        <div class="admin-home-view-shell">
          <div class="admin-home-view-header">
            <h1 class="admin-home-view-title">{tr("title")}</h1>
          </div>

          {isReady() ? (
            <div class="admin-home-view-grid">
              <a
                href={pages.users}
                class="admin-home-view-card">
                <div class="admin-home-view-card-header">
                  <Icon
                    name="group"
                    class="admin-home-view-card-icon"
                  />
                  <h2 class="admin-home-view-card-title">{tr("cards.users.title")}</h2>
                </div>
                <div class="admin-home-view-card-copy">
                  <p class="admin-home-view-card-description">
                    {tr("cards.users.description")}
                  </p>
                </div>
                <div class="admin-home-view-card-bubbles">
                  <For each={statusBubbles()}>
                    {item => (
                      <span
                        class="admin-home-view-status-bubble"
                        data-status={item.key}>
                        {tr(`cards.users.statuses.${item.key}`, {
                          count: item.count,
                        })}
                      </span>
                    )}
                  </For>
                </div>
              </a>
            </div>
          ) : (
            <div class="admin-home-view-loading-state">
              <LoadingSpinner size="2rem" />
              <p>{tr("loading")}</p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

export default AdminHomeView
