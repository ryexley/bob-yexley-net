import { describe, expect, it, vi } from "vitest"
import type { Node } from "@milkdown/prose/model"
import { createMediaEmbedNodeView } from "./media-embed-node-view"

const embedNode = (over: Record<string, unknown> = {}) =>
  ({
    type: { name: "media_embed" },
    attrs: {
      key: "media/u/b/a",
      mediaType: "image",
      mimeType: "image/png",
      size: "100",
      align: "left",
      ...over,
    },
  }) as unknown as Node

describe("createMediaEmbedNodeView", () => {
  it("marks the embed selected without a hanging layout toolbar", () => {
    const view = {
      dispatch: vi.fn(),
      state: { tr: {}, selection: { eq: () => false } },
    }

    const nodeView = createMediaEmbedNodeView(
      embedNode(),
      view as never,
      () => 1,
    )

    expect(nodeView.dom.contentEditable).toBe("false")
    expect(nodeView.dom.querySelector(".media-layout-toolbar")).toBeNull()

    nodeView.selectNode?.()
    expect(nodeView.dom.classList.contains("is-selected")).toBe(true)

    nodeView.deselectNode?.()
    expect(nodeView.dom.classList.contains("is-selected")).toBe(false)
  })
})
