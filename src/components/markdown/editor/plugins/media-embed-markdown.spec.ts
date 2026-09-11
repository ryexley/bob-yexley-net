import { describe, expect, it } from "vitest"
import { transformMediaEmbedParagraphs } from "@/components/markdown/editor/plugins/media-embed-markdown"

describe("transformMediaEmbedParagraphs", () => {
  it("converts standalone media paragraphs into mediaEmbed nodes", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: '{media:{ key: "media/u/b/a", type: "image" }}',
            },
          ],
        },
      ],
    }

    transformMediaEmbedParagraphs(tree)

    expect(tree.children[0]).toEqual({
      type: "mediaEmbed",
      value: '{media:{ key: "media/u/b/a", type: "image" }}',
    })
  })

  it("merges paragraph-split media embeds into one mediaEmbed node", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "{" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "media: {" }],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: 'key: "media/u/b/a", type: "gif"',
            },
          ],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "}" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "}" }],
        },
      ],
    }

    transformMediaEmbedParagraphs(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.type).toBe("mediaEmbed")
    expect((tree.children[0] as { value?: string }).value).toContain(
      'key: "media/u/b/a"',
    )
  })

  it("leaves mixed paragraphs unchanged", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: 'See {media:{ key: "media/u/b/a", type: "image" }}',
            },
          ],
        },
      ],
    }

    transformMediaEmbedParagraphs(tree)

    expect(tree.children[0]?.type).toBe("paragraph")
  })
})
