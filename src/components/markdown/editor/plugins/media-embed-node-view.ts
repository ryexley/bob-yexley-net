import type { Node } from "@milkdown/prose/model"
import { NodeSelection } from "@milkdown/prose/state"
import type { EditorView, NodeView } from "@milkdown/prose/view"
import type { MediaType } from "@/modules/media/filename"
import {
  mediaEmbedDataAttributes,
  mediaEmbedEditorAttrsFromUnknown,
  MEDIA_EMBED_NODE,
  type MediaEmbedEditorAttrs,
} from "@/components/markdown/media/media-embed-syntax"
import {
  MediaVariant,
  originalUrl,
  variantUrl,
} from "@/modules/media/media-utils"
import {
  getMediaEmbedRuntime,
  subscribeMediaEmbedRuntime,
  type MediaEmbedPreview,
} from "./media-embed-runtime"

type EmbedAttrs = MediaEmbedEditorAttrs & { mediaType: MediaType }

const attrsFromNode = (node: Node): EmbedAttrs => {
  const attrs = mediaEmbedEditorAttrsFromUnknown(node.attrs)
  return {
    ...attrs,
    mediaType: attrs.mediaType as MediaType,
  }
}

const fallbackPreview = (attrs: EmbedAttrs): MediaEmbedPreview => {
  const preview: MediaEmbedPreview = {
    key: attrs.key,
    mediaType: attrs.mediaType,
    mimeType: attrs.mimeType,
    status: "saved",
  }
  if (attrs.mediaType === "video") {
    preview.posterUrl = variantUrl(attrs.key, MediaVariant.Thumb)
    preview.mediaSrc = attrs.mimeType
      ? originalUrl(attrs.key, attrs.mimeType)
      : undefined
    return preview
  }
  if (attrs.mediaType === "gif") {
    preview.previewUrl = attrs.mimeType
      ? originalUrl(attrs.key, attrs.mimeType)
      : undefined
    preview.mediaSrc = preview.previewUrl
    return preview
  }
  preview.previewUrl = attrs.mimeType
    ? originalUrl(attrs.key, attrs.mimeType)
    : variantUrl(attrs.key, MediaVariant.Small)
  return preview
}

const resolvePreview = (attrs: EmbedAttrs): MediaEmbedPreview => {
  const live = getMediaEmbedRuntime()?.getPreview(attrs.key)
  if (!live) {
    return fallbackPreview(attrs)
  }
  return {
    ...fallbackPreview(attrs),
    ...live,
    mediaType: live.mediaType || attrs.mediaType,
    mimeType: live.mimeType || attrs.mimeType,
  }
}

const isBusy = (status?: string) =>
  status === "pending" || status === "uploading" || status === "processing"

const applyEmbedDom = (
  root: HTMLElement,
  attrs: EmbedAttrs,
  preview: MediaEmbedPreview,
) => {
  const data = mediaEmbedDataAttributes({
    ...attrs,
    mediaType: preview.mediaType,
  })
  for (const [name, value] of Object.entries(data)) {
    root.setAttribute(name, value)
  }
  if (!attrs.lightbox) {
    root.removeAttribute("data-media-lightbox")
  }
  if (preview.status) {
    root.setAttribute("data-status", preview.status)
  } else {
    root.removeAttribute("data-status")
  }
}

const renderFrame = (frame: HTMLElement, preview: MediaEmbedPreview) => {
  const existing = frame.querySelector(".media")
  const wantVideo = preview.mediaType === "video"
  const isVideo = existing instanceof HTMLVideoElement
  const isImage = existing instanceof HTMLImageElement

  if (wantVideo && !isVideo) {
    frame.replaceChildren()
    const video = document.createElement("video")
    video.className = "media"
    video.setAttribute("playsinline", "")
    video.setAttribute("preload", "metadata")
    video.controls = true
    video.autoplay = false
    const captions = document.createElement("track")
    captions.kind = "captions"
    video.append(captions)
    frame.append(video)
  } else if (!wantVideo && !isImage) {
    frame.replaceChildren()
    const image = document.createElement("img")
    image.className = "media"
    image.alt = ""
    frame.append(image)
  }

  const media = frame.querySelector(".media")
  if (media instanceof HTMLVideoElement) {
    if (preview.posterUrl) {
      videoPoster(media, preview.posterUrl)
    }
    const src = preview.mediaSrc || preview.previewUrl || ""
    if (src && media.getAttribute("src") !== src) {
      media.src = src
    }
  } else if (media instanceof HTMLImageElement) {
    const src = preview.previewUrl || preview.mediaSrc || ""
    if (src && media.getAttribute("src") !== src) {
      media.src = src
    }
  }

  let overlay = frame.querySelector(".overlay") as HTMLElement | null
  if (isBusy(preview.status) || preview.status === "error") {
    if (!overlay) {
      overlay = document.createElement("div")
      overlay.setAttribute("aria-hidden", "true")
      frame.append(overlay)
    }
    overlay.className =
      preview.status === "error" ? "overlay is-error" : "overlay"
    if (preview.status === "error") {
      overlay.textContent = "!"
    } else if (
      typeof preview.progress === "number" &&
      preview.status === "uploading"
    ) {
      overlay.textContent = `${Math.round(preview.progress)}%`
    } else {
      overlay.textContent = ""
    }
  } else {
    overlay?.remove()
  }
}

const videoPoster = (video: HTMLVideoElement, poster: string) => {
  if (video.getAttribute("poster") !== poster) {
    video.poster = poster
  }
}

export function createMediaEmbedNodeView(
  node: Node,
  view: EditorView,
  getPos?: () => number | undefined,
): NodeView {
  const dom = document.createElement("div")
  let current = node

  const frame = document.createElement("div")
  frame.className = "frame"

  const paint = () => {
    const attrs = attrsFromNode(current)
    const preview = resolvePreview(attrs)
    const selected = dom.classList.contains("is-selected")
    dom.className = "media-embed"
    if (selected) {
      dom.classList.add("is-selected")
    }
    applyEmbedDom(dom, attrs, preview)
    renderFrame(frame, preview)
  }

  const selectThisNode = (event: MouseEvent) => {
    if (event.button !== 0) {
      return
    }
    const pos = getPos?.()
    if (typeof pos !== "number") {
      return
    }
    const nodeAt = view.state.doc.nodeAt(pos)
    if (!nodeAt || nodeAt.type.name !== MEDIA_EMBED_NODE) {
      return
    }
    event.preventDefault()
    const selection = NodeSelection.create(view.state.doc, pos)
    if (!view.state.selection.eq(selection)) {
      view.dispatch(view.state.tr.setSelection(selection))
    }
  }

  dom.contentEditable = "false"
  dom.addEventListener("mousedown", selectThisNode)
  dom.append(frame)
  paint()

  const unsubscribe = subscribeMediaEmbedRuntime(() => {
    paint()
  })

  return {
    dom,
    update(next) {
      if (next.type.name !== MEDIA_EMBED_NODE) {
        return false
      }
      current = next
      paint()
      return true
    },
    selectNode() {
      dom.classList.add("is-selected")
    },
    deselectNode() {
      dom.classList.remove("is-selected")
    },
    ignoreMutation: () => true,
    stopEvent: event =>
      // Clicks would otherwise try to put a text caret in this atom node.
      event.type === "mousedown" ||
      event.type === "mouseup" ||
      event.type === "click",
    destroy() {
      dom.removeEventListener("mousedown", selectThisNode)
      unsubscribe()
    },
  }
}
