/**
 * Recover pasted media bytes from markup.
 *
 * iOS Safari does not expose a pasted photo on `clipboardData.files`. WebKit
 * reads the image off the pasteboard, wraps it in a `Blob`, and puts a
 * `<img src="blob:…">` in the pasted markup — fake URLs were replaced with blob
 * URLs specifically so pages could save the bytes
 * (https://webkit.org/blog/8170/clipboard-api-improvements/). That markup is the
 * only place a Photos image, HEIC, or GIF shows up, so it has to be fetched
 * back out, either from the `text/html` clipboard flavor or from the element
 * WebKit inserted into.
 *
 * Only `blob:` and `data:` sources are fetched. Remote `http(s)` sources are
 * skipped on purpose: pasting an article should not pull down its images.
 */
import {
  isClipboardMediaFile,
  normalizeClipboardMediaFile,
} from "./file-validation"

const MEDIA_ELEMENTS = "img[src], video[src], source[src]"

const isHarvestableSrc = (src: string): boolean =>
  src.startsWith("blob:") || src.startsWith("data:")

const harvestableSources = (root: ParentNode): string[] => {
  const sources: string[] = []
  for (const element of Array.from(root.querySelectorAll(MEDIA_ELEMENTS))) {
    const src = element.getAttribute("src")?.trim() ?? ""
    if (isHarvestableSrc(src) && !sources.includes(src)) {
      sources.push(src)
    }
  }
  return sources
}

const parseMarkup = (html: string): Document | null => {
  if (!html || typeof DOMParser === "undefined") {
    return null
  }
  try {
    return new DOMParser().parseFromString(html, "text/html")
  } catch {
    return null
  }
}

const fileFromSource = async (src: string): Promise<File | null> => {
  try {
    const response = await fetch(src)
    const blob = await response.blob()
    if (blob.size === 0) {
      return null
    }
    // Empty name on purpose: normalizing derives one with the right extension,
    // which the R2 key and the processing route both depend on.
    const candidate = normalizeClipboardMediaFile(
      new File([blob], "", { type: blob.type }),
      blob.type,
    )
    return isClipboardMediaFile(candidate) ? candidate : null
  } catch {
    // Revoked blob URL, or markup pointing at something we cannot read.
    return null
  }
}

const filesFromSources = async (sources: string[]): Promise<File[]> => {
  const settled = await Promise.all(sources.map(fileFromSource))
  return settled.filter((file): file is File => file != null)
}

/** Media inlined in a `text/html` clipboard flavor. */
export async function harvestMediaFromHtml(html: string): Promise<File[]> {
  const document = parseMarkup(html)
  return document ? filesFromSources(harvestableSources(document)) : []
}

/** Media WebKit already inserted into a paste target. */
export async function harvestMediaFromElement(
  root: HTMLElement,
): Promise<File[]> {
  return filesFromSources(harvestableSources(root))
}

/**
 * True when pasted markup is media and nothing else. A copied photo arrives as
 * a bare `<img>`; a copied article arrives as prose that happens to contain
 * images, and pasting that should stay a normal text paste.
 */
export function htmlIsMediaOnly(html: string): boolean {
  const document = parseMarkup(html)
  if (!document) {
    return false
  }
  return (
    harvestableSources(document).length > 0 &&
    (document.body?.textContent ?? "").trim().length === 0
  )
}

/** `text/html` off a paste event. Must run synchronously inside the handler. */
export function readClipboardHtml(
  data: DataTransfer | null | undefined,
): string {
  if (typeof data?.getData !== "function") {
    return ""
  }
  try {
    return data.getData("text/html") ?? ""
  } catch {
    return ""
  }
}
