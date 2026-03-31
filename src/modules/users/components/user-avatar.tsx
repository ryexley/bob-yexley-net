import { Show, splitProps } from "solid-js"
import type { AppRole } from "@/lib/vendor/supabase/browser"
import { Icon } from "@/components/icon"
import { cx } from "@/util"
import "./user-avatar.css"

type UserAvatarSize = "sm" | "md" | "lg"
type UserAvatarVariant = "bare" | "surface"
type UserAvatarBadgeMode = "superuser" | "privileged"

type UserAvatarProps = {
  role?: AppRole | null
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
    "size",
    "variant",
    "badgeMode",
    "class",
  ])

  return (
    <span
      class={cx(
        "user-avatar",
        local.variant ?? "surface",
        local.size ?? "md",
        local.class,
      )}
      {...rest}>
      <Icon name="account_circle" />
      <Show when={shouldShowBadge(local.role, local.badgeMode ?? "superuser")}>
        <span class="user-avatar-badge" aria-hidden="true">
          <Icon name="shield_person" />
        </span>
      </Show>
    </span>
  )
}
