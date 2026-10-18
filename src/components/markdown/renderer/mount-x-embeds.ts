import {
  coerceXEmbedProps,
  type XEmbedProps,
} from "@/components/markdown/x/x-embed-syntax"

const mountDisposers = new WeakMap<HTMLElement, Array<() => void>>()

function clearXEmbedMounts(container: HTMLElement) {
  const disposers = mountDisposers.get(container)
  if (!disposers) {
    return
  }
  for (const dispose of disposers) {
    dispose()
  }
  mountDisposers.delete(container)
}

export function mountMarkdownXEmbeds(
  container: HTMLElement,
  renderEmbed: (props: XEmbedProps, target: Element) => () => void,
) {
  clearXEmbedMounts(container)

  const nodes = container.querySelectorAll("[data-x-embed-props]")
  const disposers: Array<() => void> = []

  for (const node of nodes) {
    const encoded = node.getAttribute("data-x-embed-props")
    if (!encoded) {
      continue
    }
    let props: XEmbedProps | null = null
    try {
      props = coerceXEmbedProps(JSON.parse(decodeURIComponent(encoded)))
    } catch {
      props = null
    }
    if (!props) {
      continue
    }
    if (node instanceof HTMLElement) {
      node.replaceChildren()
    }
    disposers.push(renderEmbed(props, node))
  }

  if (disposers.length > 0) {
    mountDisposers.set(container, disposers)
  }
}

export function unmountMarkdownXEmbeds(container: HTMLElement) {
  clearXEmbedMounts(container)
}
