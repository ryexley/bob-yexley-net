import { splitProps } from "solid-js"

/** A row that renders one of the three rows with fixed spacing */
function Row(props) {
  const [local] = splitProps(props, ["y"])
  // Left x = 176, right x = 336 → width 160 for 3 glyphs.
  // We center the row at x=256 and set textLength=160 so spacing is uniform.
  // We render with three separate <tspan>s to keep exact positions but one shaping run.
  return (
    <text
      x="256"
      y={local.y}
      lengthAdjust="spacingAndGlyphs"
      textLength="160">
      {/* Pick content per row by Y coordinate */}
      <tspan>{local.y === 176 ? "BOB" : local.y === 256 ? "YEX" : "LEY"}</tspan>
    </text>
  )
}

export function Monogram(props) {
  const [{ size = 64, color = "currentColor", ring = true }, rest] = splitProps(
    props,
    ["size", "color", "ring"],
  )

  // We draw in a 512x512 viewBox and let the browser scale it.
  // The circle stroke is set to non-scaling for crispness.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      role="img"
      aria-label="Bob Yexley monogram logo"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      shape-rendering="geometricPrecision"
      text-rendering="geometricPrecision"
      {...rest}
      style={{ display: "block", color }}>
      <title>BOB YEX LEY — Circular Monogram</title>

      {ring && (
        <circle
          cx="256"
          cy="256"
          r="240"
          fill="none"
          stroke="currentColor"
          stroke-width="8"
          vector-effect="non-scaling-stroke"
        />
      )}

      {/* Centered 3×3 grid using text; we force equal spacing with textLength */}
      <g
        font-family='Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif'
        font-weight="700"
        font-size="72"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="currentColor">
        {/* Grid parameters */}
        {/* We lay out each row with a fixed textLength so the three glyphs form a perfect square width */}
        {/* Row Y positions */}
        <Row y={176} />
        <Row y={256} />
        <Row y={336} />
      </g>
    </svg>
  )
}

export function GoogleLogo(props) {
  const [, rest] = splitProps(props, [])

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      {...rest}>
      <path
        fill="currentColor"
        d="M15.883 8.184c0-.544-.045-1.09-.139-1.626H8.198v3.08h4.322a3.703 3.703 0 0 1-1.6 2.432v1.999h2.58c1.513-1.394 2.383-3.451 2.383-5.885Z"
      />
      <path
        fill="currentColor"
        d="M8.198 16c2.158 0 3.978-.708 5.303-1.931l-2.578-2c-.717.489-1.643.765-2.722.765-2.087 0-3.856-1.408-4.491-3.301H1.05v2.06A8.001 8.001 0 0 0 8.197 16Z"
      />
      <path
        fill="currentColor"
        d="M3.707 9.533a4.792 4.792 0 0 1 0-3.063V4.41H1.049a8.007 8.007 0 0 0 0 7.184l2.658-2.061Z"
      />
      <path
        fill="currentColor"
        d="M8.198 3.166a4.347 4.347 0 0 1 3.07 1.2L13.55 2.08A7.689 7.689 0 0 0 8.198.001 7.998 7.998 0 0 0 1.05 4.408L3.707 6.47c.632-1.896 2.404-3.304 4.491-3.304Z"
      />
    </svg>
  )
}
