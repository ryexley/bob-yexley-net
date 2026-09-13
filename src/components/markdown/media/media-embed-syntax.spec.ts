import { describe, expect, it } from "vitest"
import {
  canonicalizeMediaEmbed,
  canonicalizeMediaEmbedBlock,
  coerceMediaEmbedProps,
  extractMediaEmbedBlock,
  findMediaEmbedRegions,
  MEDIA_EMBED_EDITOR_ATTR_DEFAULTS,
  mediaEmbedDataAttributes,
  mediaEmbedEditorAttrsFromElement,
  mediaEmbedEditorAttrsFromUnknown,
  mediaEmbedPropsToAttrs,
  normalizeMediaEmbedsInMarkdown,
  parseLeadingMediaEmbed,
  parseMediaEmbedBlock,
  parseMediaEmbedEditorAttrs,
  parseMediaEmbedObjectLiteral,
  readLeadingMediaEmbedBlock,
} from "./media-embed-syntax"

describe("extractMediaEmbedBlock", () => {
  it("extracts a standalone media embed block", () => {
    const source =
      '{media:{ key: "media/u/b/sc-20260910155200", type: "image", mime: "image/png" }}'

    expect(extractMediaEmbedBlock(source)).toEqual({
      raw: source,
      objectLiteral:
        '{ key: "media/u/b/sc-20260910155200", type: "image", mime: "image/png" }',
    })
  })

  it("reads a leading media embed when more markdown follows", () => {
    const source = `{media:{ key: "media/u/b/a", type: "gif" }}

Next paragraph`

    expect(readLeadingMediaEmbedBlock(source)?.raw).toBe(
      '{media:{ key: "media/u/b/a", type: "gif" }}',
    )
    expect(extractMediaEmbedBlock(source)).toBeNull()
  })

  it("rejects blocks with trailing content on the same line", () => {
    expect(
      extractMediaEmbedBlock(
        '{media:{ key: "media/u/b/a", type: "image" }} trailing',
      ),
    ).toBeNull()
  })
})

describe("parseMediaEmbedBlock", () => {
  it("parses key, type, and mime", () => {
    expect(
      parseMediaEmbedBlock(
        '{media:{ key: "media/u/b/a", type: "video", mime: "video/mp4" }}',
      ),
    ).toEqual({
      key: "media/u/b/a",
      type: "video",
      mime: "video/mp4",
    })
  })

  it("rejects unknown types and missing keys", () => {
    expect(
      parseMediaEmbedBlock('{media:{ key: "media/u/b/a", type: "pdf" }}'),
    ).toBeNull()
    expect(parseMediaEmbedBlock('{media:{ type: "image" }}')).toBeNull()
  })
})

describe("normalizeMediaEmbedsInMarkdown", () => {
  it("collapses paragraph-split media embeds into canonical syntax", () => {
    const markdown = `Intro

{

media: {

key: "media/u/b/sc-1",
type: "image",
mime: "image/png"

}

}

After`

    const normalized = normalizeMediaEmbedsInMarkdown(markdown)
    expect(normalized).toContain(
      canonicalizeMediaEmbed({
        key: "media/u/b/sc-1",
        type: "image",
        mime: "image/png",
      }),
    )
    expect(normalized).not.toContain("{\nmedia:")
  })

  it("drops leading blank lines before a media-only embed", () => {
    const embed = canonicalizeMediaEmbed({
      key: "media/u/b/a",
      type: "gif",
      mime: "image/gif",
    })
    expect(normalizeMediaEmbedsInMarkdown(`\n\n${embed}`)).toBe(embed)
  })
})

describe("coerceMediaEmbedProps", () => {
  it("accepts the three media types", () => {
    expect(coerceMediaEmbedProps({ key: "a", type: "image" })).toEqual({
      key: "a",
      type: "image",
    })
    expect(coerceMediaEmbedProps({ key: "a", type: "gif" })?.type).toBe("gif")
    expect(coerceMediaEmbedProps({ key: "a", type: "video" })?.type).toBe(
      "video",
    )
  })

  it("parses size and alignment, omitting column-width defaults", () => {
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        size: 50,
        align: "center",
      }),
    ).toEqual({
      key: "a",
      type: "image",
      size: "50",
      align: "center",
    })
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "gif",
        size: "100",
        align: "left",
      }),
    ).toEqual({
      key: "a",
      type: "gif",
    })
  })

  it("persists lightbox only when enabled", () => {
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        lightbox: true,
      }),
    ).toEqual({
      key: "a",
      type: "image",
      lightbox: true,
    })
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        lightbox: false,
      }),
    ).toEqual({
      key: "a",
      type: "image",
    })
    expect(
      coerceMediaEmbedProps({
        key: "a",
        type: "image",
        lightbox: "true",
      })?.lightbox,
    ).toBe(true)
  })

  it("accepts editor attr aliases for type and mime", () => {
    expect(
      coerceMediaEmbedProps({
        key: "a",
        mediaType: "video",
        mimeType: "video/mp4",
      }),
    ).toEqual({
      key: "a",
      type: "video",
      mime: "video/mp4",
    })
  })
})

describe("canonicalizeMediaEmbed", () => {
  it("persists non-default size, alignment, and lightbox", () => {
    expect(
      canonicalizeMediaEmbed({
        key: "media/u/b/a",
        type: "gif",
        size: "25",
        align: "right",
      }),
    ).toBe('{media:{key:"media/u/b/a",type:"gif",size:"25",align:"right"}}')
    expect(
      canonicalizeMediaEmbed({
        key: "media/u/b/a",
        type: "image",
        lightbox: true,
      }),
    ).toBe('{media:{key:"media/u/b/a",type:"image",lightbox:true}}')
  })
})

/**
 * The `{media:{…}}` block is hand-parsed rather than regex-matched so a brace
 * or quote inside a value cannot end the block early. These cases all come from
 * author text that happens to look like an embed: a malformed block must be
 * left as prose, never half-consumed, or saving would corrupt the document.
 */
describe("media embed block scanning", () => {
  it("keeps a quoted brace from ending the block early", () => {
    const block = readLeadingMediaEmbedBlock(
      `{media:{key:"weird{key}name",type:"image"}}`,
    )

    expect(block?.objectLiteral).toBe(`{key:"weird{key}name",type:"image"}`)
    expect(
      parseMediaEmbedBlock(`{media:{key:"weird{key}name",type:"image"}}`),
    ).toMatchObject({ key: "weird{key}name", type: "image" })
  })

  it("honours a backslash-escaped quote inside a value", () => {
    const source = `{media:{key:"quote\\"inside",type:"image"}}`

    expect(parseMediaEmbedBlock(source)).toMatchObject({
      key: 'quote"inside',
      type: "image",
    })
  })

  it("reads a single-quoted value", () => {
    expect(
      parseMediaEmbedBlock(`{media:{key:'k',type:'image'}}`),
    ).toMatchObject({ key: "k", type: "image" })
  })

  it("rejects an unterminated string", () => {
    expect(readLeadingMediaEmbedBlock(`{media:{key:"never closed`)).toBeNull()
  })

  it("rejects an unbalanced inner object", () => {
    expect(
      readLeadingMediaEmbedBlock(`{media:{key:"k",type:"image"`),
    ).toBeNull()
  })

  it("rejects a block with no closing outer brace", () => {
    expect(
      readLeadingMediaEmbedBlock(`{media:{key:"k",type:"image"}`),
    ).toBeNull()
  })

  it("rejects text that does not open with a brace", () => {
    expect(readLeadingMediaEmbedBlock(`media:{key:"k"}`)).toBeNull()
  })

  it("rejects a different key than `media`", () => {
    expect(readLeadingMediaEmbedBlock(`{mediaFoo:{key:"k"}}`)).toBeNull()
    expect(readLeadingMediaEmbedBlock(`{other:{key:"k"}}`)).toBeNull()
  })

  it("rejects a missing colon after `media`", () => {
    expect(readLeadingMediaEmbedBlock(`{media {key:"k"}}`)).toBeNull()
  })

  it("rejects a non-object value for `media`", () => {
    expect(readLeadingMediaEmbedBlock(`{media:"k"}`)).toBeNull()
  })

  it("tolerates whitespace around the structure", () => {
    expect(
      parseMediaEmbedBlock(`  { media : { key : "k" , type : "gif" } }  `),
    ).toMatchObject({ key: "k", type: "gif" })
  })
})

describe("parseMediaEmbedObjectLiteral", () => {
  it("parses a JS-style object literal with unquoted keys", () => {
    expect(parseMediaEmbedObjectLiteral(`{key:"k",type:"image"}`)).toEqual({
      key: "k",
      type: "image",
    })
  })

  it("rejects anything that is not a braced literal", () => {
    expect(parseMediaEmbedObjectLiteral(`key:"k"`)).toBeNull()
    expect(parseMediaEmbedObjectLiteral(``)).toBeNull()
  })

  it("rejects an array", () => {
    expect(parseMediaEmbedObjectLiteral(`["k"]`)).toBeNull()
  })

  it("rejects a literal that does not evaluate", () => {
    expect(parseMediaEmbedObjectLiteral(`{key:}`)).toBeNull()
  })

  it("rejects a literal evaluating to null", () => {
    expect(parseMediaEmbedObjectLiteral(`{}`)).toEqual({})
    expect(parseMediaEmbedObjectLiteral(`{"a":1}`)).toEqual({ a: 1 })
  })
})

describe("canonicalizeMediaEmbedBlock", () => {
  it("rewrites a valid block into canonical form", () => {
    expect(
      canonicalizeMediaEmbedBlock({
        raw: `{media:{ key : "k" , type : "image" }}`,
        objectLiteral: `{ key : "k" , type : "image" }`,
      }),
    ).toBe(`{media:{key:"k",type:"image"}}`)
  })

  it("preserves an unrecognized block by minifying it instead of dropping it", () => {
    // The type is not one we support, so the props cannot be coerced. Rewriting
    // it to a default would silently change the author's content, so the
    // original is kept with only whitespace removed.
    expect(
      canonicalizeMediaEmbedBlock({
        raw: `{media:{ key : "k" , type : "hologram" }}`,
        objectLiteral: `{ key : "k" , type : "hologram" }`,
      }),
    ).toBe(`{media:{key:"k",type:"hologram"}}`)
  })

  it("keeps whitespace that lives inside a quoted value while minifying", () => {
    expect(
      canonicalizeMediaEmbedBlock({
        raw: `{media:{ key : "two words" , type : "hologram" }}`,
        objectLiteral: `{ key : "two words" , type : "hologram" }`,
      }),
    ).toBe(`{media:{key:"two words",type:"hologram"}}`)
  })
})

describe("findMediaEmbedRegions", () => {
  it("finds every embed in a document", () => {
    const content = [
      `{media:{key:"a",type:"image"}}`,
      `some prose`,
      `{media:{key:"b",type:"video"}}`,
    ].join("\n\n")

    const regions = findMediaEmbedRegions(content)

    expect(regions).toHaveLength(2)
    expect(content.slice(regions[0].start, regions[0].end)).toBe(
      `{media:{key:"a",type:"image"}}`,
    )
    expect(content.slice(regions[1].start, regions[1].end)).toBe(
      `{media:{key:"b",type:"video"}}`,
    )
  })

  it("ignores braces that do not open an embed", () => {
    expect(findMediaEmbedRegions(`{not:an:embed} and { } text`)).toEqual([])
  })

  it("skips a block whose props are not valid", () => {
    expect(findMediaEmbedRegions(`{media:{key:"a",type:"hologram"}}`)).toEqual(
      [],
    )
  })

  it("returns the content unchanged when it holds no embeds", () => {
    expect(normalizeMediaEmbedsInMarkdown("just prose")).toBe("just prose")
  })
})

describe("media embed editor attributes", () => {
  it("maps props onto node attrs, filling defaults", () => {
    expect(mediaEmbedPropsToAttrs({ key: "k", type: "image" })).toEqual({
      key: "k",
      mediaType: "image",
      mimeType: "",
      size: "100",
      align: "left",
      lightbox: false,
    })
  })

  it("maps every prop through when all are set", () => {
    expect(
      mediaEmbedPropsToAttrs({
        key: "k",
        type: "video",
        mime: "video/mp4",
        size: "50",
        align: "center",
        lightbox: true,
      }),
    ).toEqual({
      key: "k",
      mediaType: "video",
      mimeType: "video/mp4",
      size: "50",
      align: "center",
      lightbox: true,
    })
  })

  it("accepts either the attr name or the markdown alias", () => {
    expect(
      mediaEmbedEditorAttrsFromUnknown({
        key: "k",
        type: "gif",
        mime: "image/gif",
      }),
    ).toMatchObject({ mediaType: "gif", mimeType: "image/gif" })

    expect(
      mediaEmbedEditorAttrsFromUnknown({
        key: "k",
        mediaType: "video",
        mimeType: "video/mp4",
      }),
    ).toMatchObject({ mediaType: "video", mimeType: "video/mp4" })
  })

  it("falls back to defaults for missing or unusable values", () => {
    expect(mediaEmbedEditorAttrsFromUnknown({})).toEqual(
      MEDIA_EMBED_EDITOR_ATTR_DEFAULTS,
    )
  })

  it("stringifies a non-string key rather than dropping it", () => {
    expect(mediaEmbedEditorAttrsFromUnknown({ key: 42 }).key).toBe("42")
  })

  it("renders the data attributes the node view and parser share", () => {
    expect(
      mediaEmbedDataAttributes({
        key: "k",
        mediaType: "image",
        mimeType: "image/jpeg",
        size: "50",
        align: "right",
        lightbox: false,
      }),
    ).toEqual({
      "data-media-embed": "",
      "data-media-key": "k",
      "data-media-type": "image",
      "data-media-mime": "image/jpeg",
      "data-media-size": "50",
      "data-media-align": "right",
    })
  })

  it("emits the lightbox attribute only when enabled", () => {
    const data = mediaEmbedDataAttributes({
      key: "k",
      mediaType: "image",
      mimeType: "",
      size: "100",
      align: "left",
      lightbox: true,
    })

    expect(data["data-media-lightbox"]).toBe("true")
  })

  it("round-trips attributes back off a rendered element", () => {
    const attrs = {
      key: "media/u/b/photo",
      mediaType: "video" as const,
      mimeType: "video/mp4",
      size: "25" as const,
      align: "center" as const,
      lightbox: true,
    }
    const data = mediaEmbedDataAttributes(attrs)

    expect(
      mediaEmbedEditorAttrsFromElement({
        getAttribute: (name: string) => data[name] ?? null,
      }),
    ).toEqual(attrs)
  })

  it("defaults attributes absent from the element", () => {
    expect(
      mediaEmbedEditorAttrsFromElement({ getAttribute: () => null }),
    ).toEqual(MEDIA_EMBED_EDITOR_ATTR_DEFAULTS)
  })
})

describe("parseLeadingMediaEmbed", () => {
  it("returns the raw match alongside the parsed props", () => {
    const parsed = parseLeadingMediaEmbed(
      `{media:{key:"k",type:"image"}}\n\nmore prose`,
    )

    expect(parsed?.raw).toBe(`{media:{key:"k",type:"image"}}`)
    expect(parsed?.props).toMatchObject({ key: "k", type: "image" })
  })

  it("returns null when no block leads the source", () => {
    expect(parseLeadingMediaEmbed("prose first")).toBeNull()
  })

  it("returns null when the leading block has unusable props", () => {
    expect(parseLeadingMediaEmbed(`{media:{type:"image"}}`)).toBeNull()
  })
})

describe("parseMediaEmbedEditorAttrs", () => {
  it("converts a canonical block straight into node attrs", () => {
    expect(
      parseMediaEmbedEditorAttrs(
        `{media:{key:"k",type:"image",size:"50",align:"right",lightbox:true}}`,
      ),
    ).toEqual({
      key: "k",
      mediaType: "image",
      mimeType: "",
      size: "50",
      align: "right",
      lightbox: true,
    })
  })

  it("returns null for a value that is not a media block", () => {
    expect(parseMediaEmbedEditorAttrs("not a block")).toBeNull()
  })
})
