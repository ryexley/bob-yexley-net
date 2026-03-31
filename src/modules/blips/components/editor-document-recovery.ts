export function restoreEditorDocumentInteractionState() {
  if (typeof document === "undefined") {
    return
  }

  const body = document.body
  const html = document.documentElement

  if (body.style.pointerEvents === "none") {
    body.style.pointerEvents = ""
  }

  if (body.style.overflow === "hidden") {
    body.style.overflow = ""
  }

  if (html.style.overflow === "hidden") {
    html.style.overflow = ""
  }
}
