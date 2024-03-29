export const isEmpty = target => {
  if (Array.isArray(target)) {
    return (
      target.length === 0 ||
      (target.length === 1 && isEmpty(target[0]))
    )
  }

  return typeof target === "undefined" ||
    target === null ||
    target === ""
}

export const isNotEmpty = target => (!isEmpty(target))
