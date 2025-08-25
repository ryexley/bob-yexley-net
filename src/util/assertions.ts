export const isString = target => typeof target === "string"
export const isObject = target =>
  !Array.isArray(target) && target === Object(target)

export const isEmpty = value => {
  if (value == null) return true // catches null and undefined

  if (typeof value === "string" || Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0
  }

  return false // Numbers, booleans, symbols, functions etc. are not "empty"
}

export const isNotEmpty = value => !isEmpty(value)
