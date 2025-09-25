import { marked, type MarkedOptions } from "marked"
import { rendererExtensions } from "./extensions"

const createBlipMarkedOptions = (): MarkedOptions => {
  const renderer = new marked.Renderer()
  for (const extension of rendererExtensions) {
    extension.extendRenderer(renderer)
  }

  return { renderer }
}

export const blipMarkedOptions = createBlipMarkedOptions()
