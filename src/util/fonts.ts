import FontFaceObserver from "fontfaceobserver"

export async function handleIconsReady() {
  const materialIcons = new FontFaceObserver("Material Icons")
  const materialSymbols = new FontFaceObserver("Material Symbols Outlined")

  try {
    await materialIcons.load(null, 10000)
    document?.body?.classList?.add("material-icons-loaded")
  } catch {
    document?.body?.classList?.add("material-icons-not-loaded")
  }

  try {
    await materialSymbols.load(null, 30000)
    document?.body?.classList?.add("material-symbols-loaded")
  } catch {
    document?.body?.classList?.add("material-symbols-not-loaded")
  }
}
