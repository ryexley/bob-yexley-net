import { Show, createMemo, splitProps } from "solid-js"
import type { AppRole } from "@/lib/vendor/supabase/browser"
import { Icon } from "@/components/icon"
import { Tooltip } from "@/components/tooltip"
import { getAvatarPresentation } from "@/util/avatar"
import { cx } from "@/util"
import "./user-avatar.css"

type UserAvatarSize = "sm" | "md" | "lg"
type UserAvatarVariant = "bare" | "surface"
type UserAvatarBadgeMode = "superuser" | "privileged"

type UserAvatarProps = {
  role?: AppRole | null
  displayName?: string | null
  avatarSeed?: string | null
  avatarVersion?: number | null
  size?: UserAvatarSize
  variant?: UserAvatarVariant
  badgeMode?: UserAvatarBadgeMode
  class?: string
  "aria-hidden"?: boolean
}

const shouldShowBadge = (
  role: AppRole | null | undefined,
  badgeMode: UserAvatarBadgeMode,
) => {
  if (!role) {
    return false
  }

  if (badgeMode === "privileged") {
    return role === "admin" || role === "superuser"
  }

  return role === "superuser"
}

export function UserAvatar(props: UserAvatarProps) {
  const [local, rest] = splitProps(props, [
    "role",
    "displayName",
    "avatarSeed",
    "avatarVersion",
    "size",
    "variant",
    "badgeMode",
    "class",
    "aria-hidden",
  ])
  const presentation = createMemo(() =>
    getAvatarPresentation({
      displayName: local.displayName,
      avatarSeed: local.avatarSeed,
      avatarVersion: local.avatarVersion,
    }),
  )
  const tooltipLabel = createMemo(() => local.displayName?.trim() ?? "")
  const avatar = () => (
    <span
      class={cx(
        "user-avatar",
        { "has-initials": Boolean(presentation().initials) },
        local.variant ?? "surface",
        local.size ?? "md",
        local.class,
      )}
      style={presentation().style}
      aria-hidden={local["aria-hidden"]}
      {...rest}>
      <Show
        when={presentation().initials}
        fallback={<Icon name="account_circle" />}>
        <span class="user-avatar-initials">{presentation().initials}</span>
      </Show>
      <Show when={shouldShowBadge(local.role, local.badgeMode ?? "superuser")}>
        <span class="user-avatar-badge" aria-hidden="true">
          <Icon name="shield_person" />
        </span>
      </Show>
    </span>
  )

  return (
    <Tooltip
      content={tooltipLabel()}
      touchMode="popover"
      disabled={local["aria-hidden"] || tooltipLabel().length === 0}
      triggerClass="user-avatar-trigger"
      triggerProps={{
        "aria-label": tooltipLabel(),
      }}
      placement="top">
      {avatar()}
    </Tooltip>
  )
}
