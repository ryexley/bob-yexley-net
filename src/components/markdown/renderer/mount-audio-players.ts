import type { AudioPlayerProps } from "@/components/audio-player"
import { coerceAudioPlayerProps } from "@/components/markdown/audio/audio-embed-syntax"

const mountDisposers = new WeakMap<HTMLElement, Array<() => void>>()

function clearAudioPlayerMounts(container: HTMLElement) {
  const disposers = mountDisposers.get(container)
  if (!disposers) {
    return
  }

  for (const dispose of disposers) {
    dispose()
  }

  mountDisposers.delete(container)
}

export function mountMarkdownAudioPlayers(
  container: HTMLElement,
  renderPlayer: (props: AudioPlayerProps, target: Element) => () => void,
) {
  clearAudioPlayerMounts(container)

  const nodes = container.querySelectorAll("[data-audio-player-props]")
  const disposers: Array<() => void> = []

  for (const node of nodes) {
    const encoded = node.getAttribute("data-audio-player-props")
    if (!encoded) {
      continue
    }

    let props: AudioPlayerProps | null = null
    try {
      props = coerceAudioPlayerProps(JSON.parse(decodeURIComponent(encoded)))
    } catch {
      props = null
    }

    if (!props) {
      continue
    }

    disposers.push(renderPlayer(props, node))
  }

  if (disposers.length > 0) {
    mountDisposers.set(container, disposers)
  }
}

export function unmountMarkdownAudioPlayers(container: HTMLElement) {
  clearAudioPlayerMounts(container)
}
