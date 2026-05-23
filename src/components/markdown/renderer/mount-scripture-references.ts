import type { ScriptureReferenceProps } from "@/modules/blips/components/scripture-reference"

const mountDisposers = new WeakMap<HTMLElement, Array<() => void>>()

export type ScriptureReferenceMountProps = Omit<ScriptureReferenceProps, "children"> & {
  displayText: string
}

function clearScriptureReferenceMounts(container: HTMLElement) {
  const disposers = mountDisposers.get(container)
  if (!disposers) {
    return
  }

  for (const dispose of disposers) {
    dispose()
  }

  mountDisposers.delete(container)
}

export function readScriptureReferenceMountProps(
  node: HTMLElement,
): ScriptureReferenceMountProps | null {
  const book = node.dataset.book
  const chapter = Number.parseInt(node.dataset.chapter ?? "", 10)
  const startVerse = Number.parseInt(node.dataset.startVerse ?? "", 10)
  const endVerseValue = node.dataset.endVerse
  const normalized = node.dataset.normalized

  if (!book || !Number.isFinite(chapter) || !Number.isFinite(startVerse)) {
    return null
  }

  let endVerse: number | null = null
  if (endVerseValue) {
    const parsedEndVerse = Number.parseInt(endVerseValue, 10)
    if (!Number.isFinite(parsedEndVerse)) {
      return null
    }

    endVerse = parsedEndVerse
  }

  return {
    book,
    chapter,
    startVerse,
    endVerse,
    normalized: normalized ?? `${book} ${chapter}:${startVerse}`,
    displayText: node.textContent?.trim() || normalized || book,
  }
}

export function mountMarkdownScriptureReferences(
  container: HTMLElement,
  renderReference: (
    props: ScriptureReferenceMountProps,
    target: HTMLElement,
  ) => () => void,
) {
  clearScriptureReferenceMounts(container)

  const nodes = container.querySelectorAll(".scripture-reference")
  const disposers: Array<() => void> = []

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue
    }

    const props = readScriptureReferenceMountProps(node)
    if (!props) {
      continue
    }

    node.replaceChildren()
    disposers.push(renderReference(props, node))
  }

  if (disposers.length > 0) {
    mountDisposers.set(container, disposers)
  }
}

export function unmountMarkdownScriptureReferences(container: HTMLElement) {
  clearScriptureReferenceMounts(container)
}
