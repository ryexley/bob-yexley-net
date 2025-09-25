import { marked } from "marked"

export type RendererExtension = {
  extendRenderer: (renderer: InstanceType<typeof marked.Renderer>) => void
}
