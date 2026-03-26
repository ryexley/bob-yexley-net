import { isEmpty } from "@/util"

export const SESSION_STARTED_AT_STORAGE_KEY = "auth:session-started-at"

export function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage
}

export function getSessionStartedAtMs() {
  if (!canUseStorage()) {
    return null
  }

  const raw = window.localStorage.getItem(SESSION_STARTED_AT_STORAGE_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export function setSessionStartedAtMs(timestampMs: number) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(SESSION_STARTED_AT_STORAGE_KEY, String(timestampMs))
}

export function clearSessionStartedAtMs() {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(SESSION_STARTED_AT_STORAGE_KEY)
}

export function getSessionAgeMs(): number | null {
  const sessionStartedAtMs = getSessionStartedAtMs()
  if (isEmpty(sessionStartedAtMs)) {
    return null
  }

  return Date.now() - sessionStartedAtMs
}

export function hasSessionStartedAt(): boolean {
  return !isEmpty(getSessionStartedAtMs())
}

export function markSessionStartIfMissing(timestampMs: number = Date.now()): void {
  if (!hasSessionStartedAt()) {
    setSessionStartedAtMs(timestampMs)
  }
}

export function isSessionExpired(maxSessionAgeMs: number): boolean {
  const ageMs = getSessionAgeMs()
  if (isEmpty(ageMs)) {
    return true
  }

  return ageMs > maxSessionAgeMs
}
