import { createMemo } from "solid-js"
import type { AppRole } from "@/lib/vendor/supabase/browser"
import {
  SegmentedControlField,
  type SegmentedControlFieldOption,
} from "@/modules/users/components/segmented-control-field"
import { ptr } from "@/i18n"
import { clsx as cx } from "@/util"

const tr = ptr("users.shared.roles")

type UserRoleSegmentedControlProps = {
  value: AppRole
  onChange: (value: AppRole) => void
  label?: string
  disabled?: boolean
  class?: string
}

export function UserRoleSegmentedControl(props: UserRoleSegmentedControlProps) {
  const options = createMemo<SegmentedControlFieldOption<AppRole>[]>(() =>
    (["visitor", "admin", "superuser"] as const).map(value => ({
      value,
      label: tr(value),
    })),
  )

  return (
    <SegmentedControlField
      value={props.value}
      options={options()}
      onChange={props.onChange}
      disabled={props.disabled}
      label={props.label}
      class={cx("user-role-segmented-control", props.class)}
    />
  )
}
