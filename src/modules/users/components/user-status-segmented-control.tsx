import { createMemo } from "solid-js"
import type { UserStatusFilter } from "@/modules/users/data/types"
import {
  SegmentedControlField,
  type SegmentedControlFieldOption,
} from "@/modules/users/components/segmented-control-field"
import { ptr } from "@/i18n"
import { clsx as cx } from "@/util"

const tr = ptr("users.shared.statuses")

type UserStatusSegmentedControlProps = {
  value: UserStatusFilter
  onChange: (value: UserStatusFilter) => void
  includeAll?: boolean
  label?: string
  disabled?: boolean
  class?: string
}

export function UserStatusSegmentedControl(props: UserStatusSegmentedControlProps) {
  const options = createMemo<SegmentedControlFieldOption<UserStatusFilter>[]>(() => {
    const values: UserStatusFilter[] = props.includeAll
      ? ["all", "pending", "active", "locked"]
      : ["pending", "active", "locked"]

    return values.map(value => ({
      value,
      label: tr(value),
    }))
  })

  return (
    <SegmentedControlField
      value={props.value}
      options={options()}
      onChange={props.onChange}
      disabled={props.disabled}
      label={props.label}
      class={cx("user-status-segmented-control", props.class)}
    />
  )
}
