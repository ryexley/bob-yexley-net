import { editorStateCtx, editorViewCtx } from "@milkdown/core"
import { describe, expect, it, vi } from "vitest"
import {
  getSelectedMediaEmbed,
  mediaLayoutOptions,
  mediaLayoutOptionsForType,
  patchSelectedMediaEmbed,
  withSelectionOverride,
} from "./media-embed-layout"

const embedNode = (attrs: Record<string, unknown> = {}) => ({
  type: { name: "media_embed" },
  attrs: {
    key: "media/u/b/a",
    size: "100",
    align: "left",
    ...attrs,
  },
})

const patchCtx = (node: ReturnType<typeof embedNode>, from = 7) => {
  const setNodeMarkup = vi.fn()
  const dispatch = vi.fn()
  setNodeMarkup.mockReturnValue("tr")
  return {
    setNodeMarkup,
    dispatch,
    ctx: {
      get: (token: unknown) => {
        if (token === editorViewCtx) {
          return {
            dispatch,
            state: { tr: { setNodeMarkup } },
          }
        }
        if (token === editorStateCtx) {
          return { selection: { from, node } }
        }
        return undefined
      },
    },
  }
}

describe("media embed layout commands", () => {
  it("reads the selected media_embed node", () => {
    const node = embedNode({ size: "50", align: "right" })
    const ctx = {
      get: () => ({
        selection: { from: 3, node },
      }),
    }

    expect(getSelectedMediaEmbed(ctx)).toEqual({ pos: 3, node })
  })

  it("uses an explicit selection override over editor state", () => {
    const overrideNode = embedNode({ size: "25", align: "right" })
    const staleNode = embedNode({ size: "100", align: "left" })
    const ctx = {
      get: () => ({
        selection: { from: 9, node: staleNode },
      }),
      selectionOverride: { from: 2, node: overrideNode },
    }

    expect(getSelectedMediaEmbed(ctx)).toEqual({
      pos: 2,
      node: overrideNode,
    })
  })

  it("treats a text caret override as not selecting an embed", () => {
    const staleNode = embedNode()
    const ctx = {
      get: () => ({
        selection: { from: 2, node: staleNode },
      }),
      selectionOverride: { from: 4 },
    }

    expect(getSelectedMediaEmbed(ctx)).toBeNull()
  })

  it("ignores selections that are not media embeds", () => {
    const ctx = {
      get: () => ({
        selection: { from: 1 },
      }),
    }

    expect(getSelectedMediaEmbed(ctx)).toBeNull()
  })

  it("patches size on the selected embed", () => {
    const { ctx, setNodeMarkup, dispatch } = patchCtx(embedNode())

    patchSelectedMediaEmbed(ctx, { size: "25" })

    expect(setNodeMarkup).toHaveBeenCalledWith(
      7,
      undefined,
      expect.objectContaining({ size: "25", align: "left" }),
    )
    expect(dispatch).toHaveBeenCalledWith("tr")
  })

  it("invokes setNodeMarkup on the transaction", () => {
    const transaction = {
      setNodeMarkup: vi.fn(function (this: { marker: string }) {
        expect(this.marker).toBe("tr")
        return "patched"
      }),
      marker: "tr",
    }
    const dispatch = vi.fn()
    const node = embedNode()
    const ctx = {
      get: (token: unknown) => {
        if (token === editorViewCtx) {
          return {
            dispatch,
            state: { tr: transaction },
          }
        }
        if (token === editorStateCtx) {
          return { selection: { from: 7, node } }
        }
        return undefined
      },
    }

    patchSelectedMediaEmbed(ctx, { lightbox: false })

    expect(transaction.setNodeMarkup).toHaveBeenCalledWith(
      7,
      undefined,
      expect.objectContaining({ lightbox: false }),
    )
    expect(dispatch).toHaveBeenCalledWith("patched")
  })

  it("does not patch when the editor view is missing", () => {
    const node = embedNode()
    const ctx = {
      get: (token: unknown) => {
        if (token === editorStateCtx) {
          return { selection: { from: 7, node } }
        }
        return undefined
      },
    }

    expect(() => patchSelectedMediaEmbed(ctx, { size: "25" })).not.toThrow()
  })

  it("marks the current size and align as active", () => {
    const ctx = {
      get: () => ({
        selection: {
          from: 1,
          node: embedNode({ size: "50", align: "center" }),
        },
      }),
    }

    const active = mediaLayoutOptions
      .filter(option => option.isActive?.(ctx))
      .map(option => option.key)

    expect(active).toEqual(["media-size-50", "media-align-center"])
  })

  it("active size follows the selection override", () => {
    const ctx = {
      get: () => ({
        selection: {
          from: 1,
          node: embedNode({ size: "100", align: "left" }),
        },
      }),
    }
    const resolved = withSelectionOverride(ctx, {
      from: 2,
      node: embedNode({ size: "25", align: "right" }),
    })

    const active = mediaLayoutOptions
      .filter(option => option.isActive?.(resolved))
      .map(option => option.key)

    expect(active).toEqual(["media-size-25", "media-align-right"])
  })

  it("toggles lightbox on the selected embed", () => {
    const { ctx, setNodeMarkup } = patchCtx(embedNode({ lightbox: false }))
    const lightbox = mediaLayoutOptions.find(
      option => option.key === "media-lightbox",
    )
    lightbox?.handler(ctx)

    expect(setNodeMarkup).toHaveBeenCalledWith(
      7,
      undefined,
      expect.objectContaining({ lightbox: true }),
    )
  })

  it("hides the lightbox toggle for non-image embeds", () => {
    expect(
      mediaLayoutOptionsForType("gif").some(
        option => option.key === "media-lightbox",
      ),
    ).toBe(false)
    expect(
      mediaLayoutOptionsForType("image").some(
        option => option.key === "media-lightbox",
      ),
    ).toBe(true)
  })
})
