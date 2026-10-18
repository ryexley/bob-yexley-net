import { describe, expect, it } from "vitest"
import { transformXEmbedParagraphs } from "./x-embed-markdown"

describe("transformXEmbedParagraphs", () => {
  it("converts a standalone X URL paragraph into an xEmbed node", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: "https://x.com/stephenthompson/status/123",
            },
          ],
        },
      ],
    }

    transformXEmbedParagraphs(tree)

    expect(tree.children[0]).toEqual({
      type: "xEmbed",
      value: '{x:{url:"https://x.com/stephenthompson/status/123"}}',
    })
  })

  it("converts {x:{url}} shorthand paragraphs", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: '{x:{url:"https://x.com/a/status/1"}}',
            },
          ],
        },
      ],
    }

    transformXEmbedParagraphs(tree)

    expect(tree.children[0]?.type).toBe("xEmbed")
  })

  it("drops a leading break paragraph before an embed", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "html", value: "<br />" }],
        },
        {
          type: "xEmbed",
          value: '{x:{url:"https://x.com/a/status/1"}}',
        },
      ],
    }

    transformXEmbedParagraphs(tree)

    expect(tree.children).toEqual([
      {
        type: "xEmbed",
        value: '{x:{url:"https://x.com/a/status/1"}}',
      },
    ])
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
              value: "See https://x.com/a/status/1 please",
            },
          ],
        },
      ],
    }

    transformXEmbedParagraphs(tree)

    expect(tree.children[0]?.type).toBe("paragraph")
  })
})
