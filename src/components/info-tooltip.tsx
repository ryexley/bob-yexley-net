import { mergeProps, type JSXElement } from "solid-js"
import { Icon } from "@/components/icon"
import { Tooltip } from "@/components/tooltip"
import { cx } from "@/util"
import "./info-tooltip.css"

type InfoTooltipProps = {
  info: JSXElement
  icon?: string
  class?: string
  iconClass?: string
  contentClass?: string
  "aria-label"?: string
}

export function InfoTooltip(props: InfoTooltipProps) {
  const local = mergeProps(
    {
      icon: "help",
    },
    props,
  )

  return (
    <Tooltip
      content={local.info}
      touchMode="popover"
      triggerAs="button"
      triggerClass={cx("info-tooltip-trigger", local.class)}
      contentClass={local.contentClass}
      triggerProps={{
        type: "button",
        "aria-label": local["aria-label"] ?? "More information",
      }}>
      <Icon
        name={local.icon}
        class={cx("info-tooltip-icon", local.iconClass)}
      />
    </Tooltip>
  )
}
