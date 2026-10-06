import { splitProps, type JSX } from "solid-js"
import { cx } from "~/util"
import { iconGlyphs, type IconName } from "./icon-registry"
import "./icon.css"

export type { IconName }

export type IconProps = {
  name: IconName
  class?: string
  title?: string
  "aria-hidden"?: boolean | "true" | "false"
} & Omit<JSX.SvgSVGAttributes<SVGSVGElement>, "name" | "width" | "height">

export function Icon(props: IconProps) {
  const [local, rest] = splitProps(props, [
    "name",
    "class",
    "title",
    "aria-hidden",
  ])
  // Avoid Solid `For` inside `<svg>`: its function child minifies to a
  // one-letter call that becomes the intermittent `t is not a function` crash.
  const glyph = () => (local.name ? iconGlyphs[local.name] : undefined)
  const filled = () => glyph()?.filled === true

  return (
    <svg
      class={cx("icon", local.class)}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill={filled() ? "currentColor" : "none"}
      stroke={filled() ? "none" : "currentColor"}
      stroke-width={filled() ? 0 : 2}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={local.title ? undefined : (local["aria-hidden"] ?? true)}
      role={local.title ? "img" : undefined}
      {...rest}>
      {local.title ? <title>{local.title}</title> : null}
      {(glyph()?.paths ?? []).map(pathD => (
        <path d={pathD} />
      ))}
    </svg>
  )
}

export function ImagePlaceholder(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  const [local, rest] = splitProps(props, ["class"])

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1.5em"
      height="1.5em"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cx("icon", local.class)}
      {...rest}>
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M11 9A2 2 0 1 1 7 9a2 2 0 0 1 4 0" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

export function LoadingSpinner(
  props: JSX.SvgSVGAttributes<SVGSVGElement> & { size?: string },
) {
  const [local, rest] = splitProps(props, ["class", "size", "color"])
  const style = () => ({
    ...(local.size ? { "--size": local.size } : {}),
    ...(local.color ? { stroke: local.color } : {}),
  })

  return (
    <svg
      viewBox="0 0 24 24"
      class={cx("loading-spinner", local.class)}
      style={style()}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      <g>
        <circle
          cx="12"
          cy="12"
          r="9.5"
          fill="none"
          stroke-width="3" />
      </g>
    </svg>
  )
}

export function Blip(
  props: JSX.SvgSVGAttributes<SVGSVGElement> & {
    size?: string
    blipColor?: string
  },
) {
  const [local, attrs] = splitProps(props, ["size", "blipColor", "class"])
  const blipColor = () => local.blipColor ?? "var(--colors-success)"
  const style = () =>
    local.size
      ? {
          "--size": local.size,
          height: "var(--size)",
          width: "var(--size)",
        }
      : {}

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cx("icon blip-icon", local.class)}
      style={style()}
      {...attrs}>
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path
        class="blip-icon-accent"
        d="M4 6h.01"
        stroke={blipColor()}
      />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
      <path
        class="blip-icon-accent"
        d="M12 18h.01"
        stroke={blipColor()}
      />
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
      <circle
        cx="12"
        cy="12"
        r="2"
      />
      <path
        class="blip-icon-sweep"
        d="m13.41 10.59 5.66-5.66"
      />
    </svg>
  )
}

export function Hashtag(
  props: JSX.SvgSVGAttributes<SVGSVGElement> & { size?: string },
) {
  const [local, attrs] = splitProps(props, ["size", "class"])
  const style = () => (local.size ? { "--size": local.size } : {})

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      class={cx("icon hashtag", local.class)}
      style={style()}
      {...attrs}>
      <path
        class="line-left-vertical line-left-top all-bars"
        d="M14 6L14 22L16 22L16 6L14 6z"
      />
      <path
        class="line-left-vertical line-left-bottom all-bars"
        d="M14 28L14 34L16 34L16 28L14 28z"
      />
      <path
        class="line-right-vertical line-right-top all-bars"
        d="M24 6L24 12L26 12L26 6L24 6z"
      />
      <path
        class="line-right-vertical line-right-bottom all-bars"
        d="M24 18L24 34L26 34L26 18L24 18z"
      />
      <path
        class="line-top-horizontal line-top-left all-bars"
        d="M6 14L6 16L12 16L12 14L6 14z"
      />
      <path
        class="line-top-horizontal line-top-right all-bars"
        d="M18 14L18 16L34 16L34 14L18 14z"
      />
      <path
        class="line-bottom-horizontal line-bottom-left all-bars"
        d="M6 24L6 26L22 26L22 24L6 24z"
      />
      <path
        class="line-bottom-horizontal line-bottom-right all-bars"
        d="M28 24L28 26L34 26L34 24L28 24z"
      />
    </svg>
  )
}
