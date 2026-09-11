import { editorStateCtx, editorViewCtx } from "@milkdown/core"
import { ptr } from "@/i18n"
import {
  parseMediaEmbedAlign,
  parseMediaEmbedLightbox,
  parseMediaEmbedSize,
  type MediaEmbedAlign,
  type MediaEmbedSize,
  MEDIA_EMBED_NODE,
} from "@/components/markdown/media/media-embed-syntax"
import type { FormattingOption } from "../formatting-config"

const tr = ptr("blips.components.blipEditor.media.layout")

export type SelectedMediaEmbed = {
  pos: number
  node: {
    attrs: Record<string, unknown>
    type?: { name?: string }
  }
}

export type EmbedSelection = {
  from: number
  node?: SelectedMediaEmbed["node"]
}

export type MediaEmbedLayoutPatch = Partial<{
  size: MediaEmbedSize
  align: MediaEmbedAlign
  lightbox: boolean
}>

type Ctx = {
  get: (token: unknown) => unknown
  selectionOverride?: EmbedSelection | null
}

type EditorViewLike = {
  dispatch: (tr: unknown) => void
  state: {
    tr: {
      setNodeMarkup: (
        pos: number,
        type: undefined,
        attrs: Record<string, unknown>,
      ) => unknown
    }
  }
}

function getEditorSelection(ctx: Ctx): EmbedSelection | null {
  if (ctx.selectionOverride) {
    return ctx.selectionOverride
  }

  const view = ctx.get(editorViewCtx) as
    | { state?: { selection?: EmbedSelection } }
    | undefined
  const fromView = view?.state?.selection
  if (fromView) {
    return fromView
  }

  const state = ctx.get(editorStateCtx) as
    | { selection?: EmbedSelection }
    | undefined
  return state?.selection ?? null
}

function selectedMediaEmbedFromSelection(
  selection: EmbedSelection | null | undefined,
): SelectedMediaEmbed | null {
  const node = selection?.node
  if (!selection || !node || node.type?.name !== MEDIA_EMBED_NODE) {
    return null
  }

  return {
    pos: selection.from,
    node,
  }
}

function selectedEmbedAttr<T>(
  ctx: Ctx,
  read: (value: unknown) => T,
  attr: string,
): T | null {
  const selected = getSelectedMediaEmbed(ctx)
  return selected ? read(selected.node.attrs[attr]) : null
}

export function withSelectionOverride(
  ctx: Ctx,
  selection: EmbedSelection | null | undefined,
): Ctx {
  if (!selection) {
    return ctx
  }

  return {
    get: token => ctx.get(token),
    selectionOverride: selection,
  }
}

export function getSelectedMediaEmbed(ctx: Ctx): SelectedMediaEmbed | null {
  return selectedMediaEmbedFromSelection(getEditorSelection(ctx))
}

export function patchSelectedMediaEmbed(
  ctx: { get: (token: unknown) => unknown },
  patch: MediaEmbedLayoutPatch,
) {
  const selected = getSelectedMediaEmbed(ctx)
  const view = ctx.get(editorViewCtx) as EditorViewLike | undefined
  const transaction = view?.state?.tr
  if (
    !selected ||
    !view ||
    typeof view.dispatch !== "function" ||
    typeof transaction?.setNodeMarkup !== "function"
  ) {
    return
  }

  view.dispatch(
    transaction.setNodeMarkup(selected.pos, undefined, {
      ...selected.node.attrs,
      ...patch,
    }),
  )
}

const sizeOption = (
  size: MediaEmbedSize,
  label: string,
  ariaKey: "size25" | "size50" | "size100",
): FormattingOption => ({
  key: `media-size-${size}`,
  label,
  ariaLabel: tr(ariaKey),
  handler: ctx => patchSelectedMediaEmbed(ctx, { size }),
  isActive: ctx => selectedEmbedAttr(ctx, parseMediaEmbedSize, "size") === size,
  group: 1,
})

const alignOption = (
  align: MediaEmbedAlign,
  icon: string,
  ariaKey: "alignLeft" | "alignCenter" | "alignRight",
): FormattingOption => ({
  key: `media-align-${align}`,
  icon,
  ariaLabel: tr(ariaKey),
  handler: ctx => patchSelectedMediaEmbed(ctx, { align }),
  isActive: ctx =>
    selectedEmbedAttr(ctx, parseMediaEmbedAlign, "align") === align,
  group: 2,
})

const lightboxOption: FormattingOption = {
  key: "media-lightbox",
  icon: "fit_screen",
  ariaLabel: tr("lightbox"),
  handler: ctx => {
    const current = selectedEmbedAttr(ctx, parseMediaEmbedLightbox, "lightbox")
    if (current === null) {
      return
    }
    patchSelectedMediaEmbed(ctx, { lightbox: !current })
  },
  isActive: ctx =>
    selectedEmbedAttr(ctx, parseMediaEmbedLightbox, "lightbox") === true,
  group: 3,
}

export const mediaLayoutOptions: FormattingOption[] = [
  sizeOption("25", "25%", "size25"),
  sizeOption("50", "50%", "size50"),
  sizeOption("100", "100%", "size100"),
  alignOption("left", "format_align_left", "alignLeft"),
  alignOption("center", "format_align_center", "alignCenter"),
  alignOption("right", "format_align_right", "alignRight"),
  lightboxOption,
]

export function mediaLayoutOptionsForType(
  mediaType?: string,
): FormattingOption[] {
  if (mediaType === "image") {
    return mediaLayoutOptions
  }
  return mediaLayoutOptions.filter(option => option.key !== "media-lightbox")
}
