/** Reference-counted document scroll lock for modal overlays. */

let lockCount = 0
let savedHtmlOverflow = ""
let savedBodyOverflow = ""
let savedBodyPaddingRight = ""

export function lockDocumentScroll(): () => void {
  if (typeof document === "undefined") {
    return () => {}
  }

  if (lockCount === 0) {
    const html = document.documentElement
    const body = document.body

    savedHtmlOverflow = html.style.overflow
    savedBodyOverflow = body.style.overflow
    savedBodyPaddingRight = body.style.paddingRight

    const scrollbarWidth = window.innerWidth - html.clientWidth
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
  }

  lockCount += 1

  return () => {
    if (lockCount === 0) {
      return
    }

    lockCount -= 1
    if (lockCount > 0) {
      return
    }

    document.documentElement.style.overflow = savedHtmlOverflow
    document.body.style.overflow = savedBodyOverflow
    document.body.style.paddingRight = savedBodyPaddingRight
  }
}
