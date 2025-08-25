export function random(min = 1, max = Number.MAX_SAFE_INTEGER) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomIndex<T>(target: T[]) {
  if (!Array.isArray(target)) {
    return 0
  }

  return random(0, target.length - 1)
}
