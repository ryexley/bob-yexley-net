import { createMemo, splitProps } from "solid-js"
import { cx } from "@/util"

export function Stack(props) {
  const [local, rest] = splitProps(props, [
    "align",
    "orient",
    "justify",
    "fullHeight",
    "fullWidth",
    "gap",
    "class",
    "children",
    "style",
  ])

  const classes = createMemo(() =>
    cx(
      "flex",
      local.orient === "row" ? "flex-row" : "flex-col",
      local.align === "center"
        ? "items-center"
        : local.align === "end"
          ? "items-end"
          : "items-start",
      local.justify === "center"
        ? "justify-center"
        : local.justify === "end"
          ? "justify-end"
          : local.justify === "between"
            ? "justify-between"
            : "justify-start",
      local.fullHeight && "h-full",
      local.fullWidth && "w-full",
      local.class,
    ),
  )

  return (
    <div
      class={classes()}
      style={{ gap: local.gap ?? "0.5rem", ...local.style }}
      {...rest}>
      {local.children}
    </div>
  )
}
