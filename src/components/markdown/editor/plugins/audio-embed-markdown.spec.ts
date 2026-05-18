import { describe, expect, it } from "vitest"
import { transformAudioEmbedParagraphs } from "@/components/markdown/editor/plugins/audio-embed-markdown"

describe("transformAudioEmbedParagraphs", () => {
  it("converts standalone audio paragraphs into audioEmbed nodes", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value:
                "{audio:{ src: \"/audio/ep-1.mp3\", title: \"Episode 1\" }}",
            },
          ],
        },
      ],
    }

    transformAudioEmbedParagraphs(tree)

    expect(tree.children[0]).toEqual({
      type: "audioEmbed",
      value: "{audio:{ src: \"/audio/ep-1.mp3\", title: \"Episode 1\" }}",
    })
  })

  it("merges paragraph-split audio embeds into one audioEmbed node", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "{" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "audio: {" }],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: "src: \"https://example.com/ep-1.mp3\", title: \"Episode 1\"",
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

    transformAudioEmbedParagraphs(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.type).toBe("audioEmbed")
    expect(tree.children[0]?.value).toContain("src: \"https://example.com/ep-1.mp3\"")
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
              value: "Intro {audio:{ src: \"/audio/ep-1.mp3\" }}",
            },
          ],
        },
      ],
    }

    transformAudioEmbedParagraphs(tree)

    expect(tree.children[0]?.type).toBe("paragraph")
  })
})
