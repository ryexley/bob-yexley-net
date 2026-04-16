import { createAsync, useNavigate } from "@solidjs/router"
import { Meta, Title } from "@solidjs/meta"
import { createEffect, createMemo, createSignal, For, Show, onCleanup } from "solid-js"
import { Button } from "@/components/button"
import { Icon, LoadingSpinner } from "@/components/icon"
import { Input } from "@/components/input"
import { Select, type SelectOption } from "@/components/select"
import { Stack } from "@/components/stack"
import { useAuth } from "@/context/auth-context"
import { UserAvatar } from "@/modules/users/components/user-avatar"
import { UserEditDrawer } from "@/modules/users/components/user-edit-drawer"
import { UserStatusSegmentedControl } from "@/modules/users/components/user-status-segmented-control"
import { getAdminUsers } from "@/modules/users/data/queries"
import type {
  AdminUserRecord,
  SortDirection,
  UserSortField,
  UserStatusFilter,
} from "@/modules/users/data/types"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { windowTitle } from "@/util/browser"
import { formatLongDate } from "@/util/formatters"
import "./index.css"

const tr = ptr("users.views.index")
const trSharedStatuses = ptr("users.shared.statuses")
const trSharedRoles = ptr("users.shared.roles")
const FILTER_PANEL_ANIMATION_MS = 200

export function UsersView() {
  const navigate = useNavigate()
  const auth = useAuth()
  const adminUsersQuery = createAsync(() => getAdminUsers())
  const [users, setUsers] = createSignal<AdminUserRecord[]>([])
  const [selectedUserId, setSelectedUserId] = createSignal<string | null>(null)
  const [searchValue, setSearchValue] = createSignal("")
  const [statusFilter, setStatusFilter] = createSignal<UserStatusFilter>("all")
  const [sortField, setSortField] = createSignal<UserSortField>("createdAt")
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("desc")
  const [filtersOpen, setFiltersOpen] = createSignal(false)
  const [filtersRendered, setFiltersRendered] = createSignal(false)
  const [filtersVisible, setFiltersVisible] = createSignal(false)
  let filtersUnmountTimeout: ReturnType<typeof setTimeout> | null = null
  let filtersOpenAnimationFrame: number | null = null

  const clearFiltersUnmountTimeout = () => {
    if (filtersUnmountTimeout) {
      clearTimeout(filtersUnmountTimeout)
      filtersUnmountTimeout = null
    }
  }

  const clearFiltersOpenAnimationFrame = () => {
    if (filtersOpenAnimationFrame !== null) {
      cancelAnimationFrame(filtersOpenAnimationFrame)
      filtersOpenAnimationFrame = null
    }
  }

  createEffect(() => {
    if (filtersOpen()) {
      clearFiltersUnmountTimeout()
      clearFiltersOpenAnimationFrame()
      setFiltersRendered(true)
      setFiltersVisible(false)
      filtersOpenAnimationFrame = requestAnimationFrame(() => {
        setFiltersVisible(true)
        filtersOpenAnimationFrame = null
      })
      return
    }

    if (!filtersRendered()) {
      return
    }

    clearFiltersUnmountTimeout()
    clearFiltersOpenAnimationFrame()
    setFiltersVisible(false)
    filtersUnmountTimeout = setTimeout(() => {
      setFiltersRendered(false)
      filtersUnmountTimeout = null
    }, FILTER_PANEL_ANIMATION_MS)
  })

  onCleanup(() => {
    clearFiltersUnmountTimeout()
    clearFiltersOpenAnimationFrame()
  })

  createEffect(() => {
    const result = adminUsersQuery()
    if (!result?.users) {
      return
    }

    setUsers(result.users)
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
    const result = adminUsersQuery()
    if (auth.loading() || !auth.isSuperuser() || result === undefined) {
      return
    }

    if (!result.authorized) {
      navigate(pages.login, { replace: true })
    }
  })

  const selectedUser = createMemo(
    () => users().find(user => user.userId === selectedUserId()) ?? null,
  )
  const hasQueryResult = createMemo(() => adminUsersQuery() !== undefined)
  const pageError = createMemo(() => adminUsersQuery()?.error ?? null)
  const hasFiltersApplied = createMemo(
    () => searchValue().trim().length > 0 || statusFilter() !== "all",
  )
  const filteredUsers = createMemo(() => {
    const query = searchValue().trim().toLowerCase()
    const currentStatusFilter = statusFilter()
    const currentSortField = sortField()
    const currentSortDirection = sortDirection()
    const nextUsers = users().filter(user => {
      const matchesSearch =
        query.length === 0 ||
        user.displayName.toLowerCase().includes(query) ||
        (user.email ?? "").toLowerCase().includes(query)
      const matchesStatus =
        currentStatusFilter === "all" || user.status === currentStatusFilter

      return matchesSearch && matchesStatus
    })

    const sorted = [...nextUsers].sort((left, right) => {
      const multiplier = currentSortDirection === "asc" ? 1 : -1

      if (currentSortField === "displayName") {
        return (
          left.displayName.localeCompare(right.displayName, undefined, {
            sensitivity: "base",
          }) * multiplier
        )
      }

      return (
        (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) *
        multiplier
      )
    })

    return sorted
  })
  const summary = createMemo(() =>
    tr("summary", {
      visible: filteredUsers().length,
      total: users().length,
    }),
  )
  const sortOptions = createMemo<SelectOption[]>(() => [
    {
      value: "createdAt",
      label: tr("sort.fields.createdAt"),
    },
    {
      value: "displayName",
      label: tr("sort.fields.displayName"),
    },
  ])
  const emptyMessage = createMemo(() => {
    if (pageError()) {
      return pageError()
    }

    if (users().length === 0) {
      return tr("empty.noUsers")
    }

    return tr("empty.noMatches")
  })

  const handleUserSaved = (updatedUser: AdminUserRecord) => {
    setUsers(currentUsers =>
      currentUsers.map(user => (user.userId === updatedUser.userId ? updatedUser : user)),
    )

    if (auth.user()?.id === updatedUser.userId) {
      const currentProfile = auth.profile()
      if (currentProfile) {
        auth.replaceProfile({
          ...currentProfile,
          role: updatedUser.role,
          visitor: {
            ...currentProfile.visitor,
            id: updatedUser.visitorId,
            displayName: updatedUser.displayName,
            status: updatedUser.status,
            notes: updatedUser.notes,
            createdAt: updatedUser.createdAt,
          },
        })
      }
    }
  }

  return (
    <>
      <Title>{windowTitle(tr("pageTitle"))}</Title>
      <Meta
        name="description"
        content={tr("metaDescription")}
      />
      <main class="users-view">
        <a
          href={pages.admin}
          class="users-view-back-link">
          <Icon name="arrow_back" />
          {tr("actions.backToAdmin")}
        </a>
        <div class="users-view-shell">
          <div class="users-view-header">
            <div class="users-view-header-copy">
              <h1 class="users-view-title">{tr("title")}</h1>
              <p class="users-view-subtitle">{tr("subtitle")}</p>
            </div>
          </div>

          <Show
            when={hasQueryResult() && auth.isSuperuser()}
            fallback={
              <div class="users-view-loading-state">
                <LoadingSpinner size="2rem" />
                <p>{tr("loading")}</p>
              </div>
            }>
            <Stack
              orient="row"
              align="center"
              justify="end"
              fullWidth
              class="users-view-toolbar">
                <Select
                  options={sortOptions()}
                  value={sortField()}
                  onChange={value => {
                    if (value) {
                      setSortField(value as UserSortField)
                    }
                  }}
                  aria-label={tr("sort.fieldLabel")}
                  containerClass="users-view-sort-field"
                  triggerClass="users-view-sort-trigger"
                />

                <button
                  type="button"
                  class="users-view-toolbar-icon-button"
                  aria-label={
                    sortDirection() === "desc"
                      ? tr("sort.direction.desc")
                      : tr("sort.direction.asc")
                  }
                  onClick={() =>
                    setSortDirection(direction => (direction === "desc" ? "asc" : "desc"))
                  }>
                  <Icon name={sortDirection() === "desc" ? "south" : "north"} />
                </button>

                <button
                  type="button"
                  class="users-view-toolbar-icon-button"
                  classList={{
                    "is-active": filtersOpen(),
                  }}
                  aria-label={
                    filtersOpen() ? tr("actions.hideFilters") : tr("actions.showFilters")
                  }
                  onClick={() => setFiltersOpen(open => !open)}>
                  <Icon name={filtersOpen() ? "filter_alt_off" : "filter_alt"} />
                </button>
              </Stack>

            <Show when={filtersRendered()}>
              <div
                class="users-view-filters-motion"
                classList={{
                  "is-open": filtersVisible(),
                }}>
                <div class="users-view-filters">
                  <Input
                    label={tr("filters.search.label")}
                    type="search"
                    value={searchValue()}
                    placeholder={tr("filters.search.placeholder")}
                    onInput={event => setSearchValue(event.currentTarget.value)}
                  />
                  <UserStatusSegmentedControl
                    includeAll
                    value={statusFilter()}
                    onChange={setStatusFilter}
                    label={tr("filters.status.label")}
                  />
                  <div class="users-view-filter-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      label={tr("actions.clearFilters")}
                      disabled={!hasFiltersApplied()}
                      onClick={() => {
                        setSearchValue("")
                        setStatusFilter("all")
                      }}
                    />
                  </div>
                </div>
              </div>
            </Show>

            <div class="users-view-summary">
              <span>{summary()}</span>
            </div>

            <Show
              when={filteredUsers().length > 0}
              fallback={<div class="users-view-empty-state">{emptyMessage()}</div>}>
              <div class="users-view-list">
                <For each={filteredUsers()}>
                  {user => (
                    <button
                      type="button"
                      class="users-view-card"
                      onClick={() => setSelectedUserId(user.userId)}>
                      <div class="users-view-card-header">
                        <div class="users-view-card-identity">
                          <UserAvatar
                            class="users-view-card-avatar"
                            role={user.role}
                            displayName={user.displayName ?? user.email ?? null}
                            avatarSeed={user.avatarSeed ?? null}
                            avatarVersion={user.avatarVersion ?? null}
                            size="md"
                            variant="surface"
                            aria-hidden={true}
                          />
                          <div class="users-view-card-copy">
                            <div class="users-view-card-name">{user.displayName}</div>
                            <div class="users-view-card-email">
                              {user.email ?? tr("values.unavailable")}
                            </div>
                          </div>
                        </div>
                        <span
                          class="users-view-status-badge"
                          data-status={user.status}>
                          {trSharedStatuses(user.status)}
                        </span>
                      </div>
                      <div class="users-view-card-meta">
                        <div class="users-view-card-meta-copy">
                          <span class="users-view-card-meta-label">
                            {tr("fields.joinedAt")}
                          </span>
                          <span class="users-view-card-meta-value">
                            {formatLongDate(user.createdAt) ?? tr("values.unavailable")}
                          </span>
                        </div>
                        <span
                          class="users-view-role-text"
                          data-role={user.role}>
                          {trSharedRoles(user.role)}
                        </span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        <UserEditDrawer
          open={selectedUser() !== null}
          user={selectedUser()}
          onOpenChange={open => {
            if (!open) {
              setSelectedUserId(null)
            }
          }}
          onSaved={updatedUser => handleUserSaved(updatedUser)}
        />
      </main>
    </>
  )
}

export default UsersView
