import { createMemo, mergeProps, splitProps, JSX } from "solid-js"
import { merge, cx, isNotEmpty } from "~/util"
import "./icon.css"

export function Icon(
  props: JSX.HTMLAttributes<HTMLElement> & { name: string; outlined?: boolean },
) {
  const propsWithDefaults = mergeProps(
    {
      outlined: true,
    },
    props,
  )
  const [local, attrs] = splitProps(propsWithDefaults, [
    "name",
    "outlined",
    "class",
  ])
  const styles = createMemo(() =>
    merge(
      cx(
        "icon",
        local.outlined ? "material-symbols-outlined" : "material-icons",
      ),
      local.class,
    ),
  )

  return (
    <i
      class={styles()}
      aria-hidden="true"
      {...attrs}>
      {local.name}
    </i>
  )
}

export function ImagePlaceholder(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24px"
      viewBox="0 -960 960 960"
      width="24px"
      fill="currentColor"
      {...props}>
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Zm140-360q25 0 42.5-17.5T400-620q0-25-17.5-42.5T340-680q-25 0-42.5 17.5T280-620q0 25 17.5 42.5T340-560Z" />
    </svg>
  )
}

export function LoadingSpinner(
  props: JSX.SvgSVGAttributes<SVGSVGElement> & { size?: string },
) {
  const [local, rest] = splitProps(props, ["class", "size", "color"])
  const style = createMemo(() => ({
    ...(isNotEmpty(local.size) ? { "--size": local.size } : {}),
    ...(isNotEmpty(local.color) ? { stroke: local.color } : {}),
  }))

  return (
    <svg
      viewBox="0 0 24 24"
      class={cx("loading-spinner", local?.class)}
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
  const propsWithDefaults = mergeProps(
    {
      blipColor: "var(--colors-success)",
    },
    props,
  )
  const [local, attrs] = splitProps(propsWithDefaults, [
    "size",
    "blipColor",
    "class",
  ])
  const style = createMemo(() =>
    isNotEmpty(local.size)
      ? {
          "--size": local.size,
          height: "var(--size)",
          width: "var(--size)",
        }
      : {},
  )

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cx("lucide lucide-radar-icon lucide-radar icon", local.class)}
      style={style()}
      {...attrs}>
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path
        class="blip-icon-accent"
        d="M4 6h.01"
        stroke={local.blipColor}
      />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
      <path
        class="blip-icon-accent"
        d="M12 18h.01"
        stroke={local.blipColor}
      />
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
      <circle
        cx="12"
        cy="12"
        r="2"
      />
      <path d="m13.41 10.59 5.66-5.66" />
    </svg>
  )
}

export function Hashtag(
  props: JSX.SvgSVGAttributes<SVGSVGElement> & { size?: string },
) {
  const [local, attrs] = splitProps(props, ["size"])
  const style = createMemo(() =>
    isNotEmpty(local.size) ? { "--size": local.size } : {},
  )

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      class="icon hashtag"
      style={style()}
      {...attrs}>
      {/* Left vertical line (top segment) */}
      <path
        class="line-left-vertical line-left-top all-bars"
        d="M14 6L14 22L16 22L16 6L14 6z"
      />
      {/* Left vertical line (bottom segment) */}
      <path
        class="line-left-vertical line-left-bottom all-bars"
        d="M14 28L14 34L16 34L16 28L14 28z"
      />

      {/* Right vertical line (top segment) */}
      <path
        class="line-right-vertical line-right-top all-bars"
        d="M24 6L24 12L26 12L26 6L24 6z"
      />
      {/* Right vertical line (bottom segment) */}
      <path
        class="line-right-vertical line-right-bottom all-bars"
        d="M24 18L24 34L26 34L26 18L24 18z"
      />

      {/* Top horizontal line (left segment) */}
      <path
        class="line-top-horizontal line-top-left all-bars"
        d="M6 14L6 16L12 16L12 14L6 14z"
      />
      {/* Top horizontal line (right segment) */}
      <path
        class="line-top-horizontal line-top-right all-bars"
        d="M18 14L18 16L34 16L34 14L18 14z"
      />

      {/* Bottom horizontal line (left segment) */}
      <path
        class="line-bottom-horizontal line-bottom-left all-bars"
        d="M6 24L6 26L22 26L22 24L6 24z"
      />
      {/* Bottom horizontal line (right segment) */}
      <path
        class="line-bottom-horizontal line-bottom-right all-bars"
        d="M28 24L28 26L34 26L34 24L28 24z"
      />
    </svg>
  )
}
