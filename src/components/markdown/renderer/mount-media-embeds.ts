import {
  coerceMediaEmbedProps,
  type MediaEmbedProps,
} from "@/components/markdown/media/media-embed-syntax"

const mountDisposers = new WeakMap<HTMLElement, Array<() => void>>()

function clearMediaEmbedMounts(container: HTMLElement) {
  const disposers = mountDisposers.get(container)
  if (!disposers) {
    return
  }
  for (const dispose of disposers) {
    dispose()
  }
  mountDisposers.delete(container)
}

export function mountMarkdownMediaEmbeds(
  container: HTMLElement,
  renderEmbed: (props: MediaEmbedProps, target: Element) => () => void,
) {
  clearMediaEmbedMounts(container)

  const nodes = container.querySelectorAll("[data-media-embed-props]")
  const disposers: Array<() => void> = []

  for (const node of nodes) {
    const encoded = node.getAttribute("data-media-embed-props")
    if (!encoded) {
      continue
    }
    let props: MediaEmbedProps | null = null
    try {
      props = coerceMediaEmbedProps(JSON.parse(decodeURIComponent(encoded)))
    } catch {
      props = null
    }
    if (!props) {
      continue
    }
    disposers.push(renderEmbed(props, node))
  }

  if (disposers.length > 0) {
    mountDisposers.set(container, disposers)
  }
}

export function unmountMarkdownMediaEmbeds(container: HTMLElement) {
  clearMediaEmbedMounts(container)
}
