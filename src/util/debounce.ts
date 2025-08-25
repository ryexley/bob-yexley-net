/* Example usage:
 * const foo = msg => console.log({ msg })
 * const debouncedFoo = debounce(foo, 250)
 */
export function debounce(fn, delay = 500) {
  let timeoutId

  const debounced = (...args) => {
    return new Promise(resolve => {
      if (timeoutId) clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        resolve(fn(...args))
      }, delay)
    })
  }

  debounced.cancel = () => {
    clearTimeout(timeoutId)
  }

  return debounced
}
