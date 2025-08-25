import { tr } from "@/i18n"
import { isEmpty, isNotEmpty } from "@/util"
export const inBrowser = typeof window !== "undefined"

export function withWindow(fn) {
  if (
    typeof window !== "undefined" &&
    typeof fn !== "undefined" &&
    typeof fn === "function"
  ) {
    return fn(window)
  }
}

export function windowTitle(pageTitle: string) {
  const persistentAppTitle =
    `${tr("site.title")} - ${tr("site.description")}` || ""

  if (isNotEmpty(pageTitle)) {
    return `${pageTitle} ← ${persistentAppTitle}`
  }

  return persistentAppTitle
}

export function withNavigator(fn) {
  if (isEmpty(fn) || typeof fn !== "function") {
    return
  }

  return withWindow(window => {
    return fn(window.navigator)
  })
}

export function canUseDOM() {
  return !!(
    typeof window !== "undefined" &&
    window.document &&
    window.document.createElement
  )
}

export async function writeToClipboard(content) {
  withNavigator(async navigator => {
    if (!navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(content)
  })
}

/**
 * Adapted from
 * https://github.com/kentcdodds/kentcdodds.com/blob/main/app/utils/misc.tsx#L303-L330
 */
export function updateUrl(key, value) {
  withWindow(window => {
    const queryString = new URLSearchParams(window.location.search)
    const currentValue = queryString.get(key)

    if (value === currentValue) {
      return
    }

    if (isNotEmpty(value)) {
      queryString.set(key, value)
    } else {
      queryString.delete(key)
    }

    const newUrl = [window.location.pathname, queryString.toString()]
      .filter(Boolean)
      .join("?")

    window.history.replaceState(null, "", newUrl)
  })
}
