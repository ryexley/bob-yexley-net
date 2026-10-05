export const breakpoint = {
  xs: 320,
  s: 512,
  sm: 640,
  m: 768,
  ml: 960,
  l: 1024,
  xl: 1280,
  xxl: 1600,
  xxxl: 1920
}

/**
 * Media queries resolve `rem` against the browser's initial font size (16px by
 * default), not the html `font-size`. JS viewport checks compare against
 * `window.innerWidth` (CSS px), so breakpoints are declared in rem and
 * converted here to stay in lockstep with `@media (max-width: <n>rem)`.
 */
export const MEDIA_QUERY_REM_BASE = 16

export const remToViewportWidth = (rem: number) => rem * MEDIA_QUERY_REM_BASE
