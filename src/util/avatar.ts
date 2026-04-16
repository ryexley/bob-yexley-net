const DEFAULT_AVATAR_VERSION = 1
const AVATAR_PALETTE_VERSION = 2
const AVATAR_BACKGROUND_COLOR_OPTIONS = [
  "color-mix(in srgb, var(--colors-safety-orange-01) 30%, transparent)",
  "color-mix(in srgb, var(--colors-neon-green) 30%, transparent)",
  "color-mix(in srgb, var(--colors-arctic-lime) 30%, transparent)",
  "color-mix(in srgb, var(--colors-cool-blue) 30%, transparent)",
  "color-mix(in srgb, var(--colors-resonant-blue) 30%, transparent)",
  "color-mix(in srgb, var(--colors-cerise-pink) 30%, transparent)",
  "color-mix(in srgb, var(--colors-scarlett) 30%, transparent)",
  "color-mix(in srgb, var(--colors-seance) 30%, transparent)",
  "color-mix(in srgb, var(--colors-blue-margeurite) 30%, transparent)",
  "color-mix(in srgb, var(--colors-rebecca-purple) 30%, transparent)",
  "color-mix(in srgb, var(--colors-mono-01) 30%, transparent)",
  "color-mix(in srgb, var(--colors-mono-11) 30%, transparent)",
] as const

const normalizeSeed = (seed?: string | null) => seed?.trim() || "visitor-avatar"

const hashString = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

const getPaletteColor = (
  random: () => number,
  palette: readonly string[] = AVATAR_BACKGROUND_COLOR_OPTIONS,
) => {
  const targetPalette =
    palette.length > 0 ? palette : ["rgba(24, 36, 73, 0.3)", "rgba(33, 34, 37, 0.3)"]
  return targetPalette[Math.floor(random() * targetPalette.length)]
}

export const getAvatarInitials = (displayName?: string | null): string | null => {
  const parts = (displayName ?? "")
    .trim()
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return null
  }

  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("")
}

export const getAvatarBackground = (
  seed?: string | null,
  version: number = DEFAULT_AVATAR_VERSION,
) => {
  const random = createSeededRandom(
    hashString(
      `${normalizeSeed(seed)}:${version}:palette-${AVATAR_PALETTE_VERSION}`,
    ),
  )
  const gradients = Array.from({ length: 4 }, () => {
    const color = getPaletteColor(random)
    const x = Math.round(random() * 100)
    const y = Math.round(random() * 100)
    const size = 38 + Math.round(random() * 46)
    return `radial-gradient(circle ${size}px at ${x}% ${y}%, ${color} 0%, transparent ${size}%)`
  })

  return {
    "background-image": gradients.join(", "),
    "background-color": "color-mix(in srgb, var(--colors-mono-02) 88%, var(--colors-mono-01) 12%)",
  } as const
}

export const getAvatarPresentation = (options: {
  displayName?: string | null
  avatarSeed?: string | null
  avatarVersion?: number | null
}) => {
  const initials = getAvatarInitials(options.displayName)
  return {
    initials,
    style: getAvatarBackground(
      options.avatarSeed,
      options.avatarVersion ?? DEFAULT_AVATAR_VERSION,
    ),
  }
}
