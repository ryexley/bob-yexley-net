import { Show, type JSX, type ParentProps } from "solid-js"
import { useAuth } from "@/context/auth-context"
import type { AppRole } from "@/lib/vendor/supabase/browser"

type RequiresRoleProps = ParentProps<{
  roles: AppRole | AppRole[]
  fallback?: JSX.Element
}>

const normalizeRoles = (roles: RequiresRoleProps["roles"]) =>
  Array.isArray(roles) ? roles : [roles]

export function RequiresRole(props: RequiresRoleProps) {
  const auth = useAuth()

  const hasRequiredRole = () => {
    const currentRole = auth.role()
    if (!currentRole) {
      return false
    }

    return normalizeRoles(props.roles).includes(currentRole)
  }

  return (
    <Show when={!auth.loading() && hasRequiredRole()} fallback={props.fallback ?? null}>
      {props.children}
    </Show>
  )
}

export function RequiresAdmin(
  props: ParentProps<{
    fallback?: JSX.Element
  }>,
) {
  return (
    <RequiresRole roles={["admin", "superuser"]} fallback={props.fallback}>
      {props.children}
    </RequiresRole>
  )
}

export function RequiresSuperUser(
  props: ParentProps<{
    fallback?: JSX.Element
  }>,
) {
  return (
    <RequiresRole roles="superuser" fallback={props.fallback}>
      {props.children}
    </RequiresRole>
  )
}
