import { describe, expect, it } from "vitest"
import type { Attachment } from "@/modules/media/media-store"
import {
  mediaTypeTagsForAttachments,
  reconcileTagsWithMediaTypes,
} from "./media-tags"

const attachment = (
  overrides: Partial<Attachment> & Pick<Attachment, "mediaType">,
): Pick<Attachment, "mediaType" | "status"> => ({
  status: "saved",
  ...overrides,
})

describe("mediaTypeTagsForAttachments", () => {
  it("maps present media types to tag names", () => {
    expect(
      mediaTypeTagsForAttachments([
        attachment({ mediaType: "image" }),
        attachment({ mediaType: "video" }),
      ]),
    ).toEqual(["photos", "videos"])
  })

  it("dedupes tags for multiple items of the same type", () => {
    expect(
      mediaTypeTagsForAttachments([
        attachment({ mediaType: "gif" }),
        attachment({ mediaType: "gif" }),
      ]),
    ).toEqual(["gifs"])
  })

  it("ignores errored uploads", () => {
    expect(
      mediaTypeTagsForAttachments([
        attachment({ mediaType: "image", status: "error" }),
      ]),
    ).toEqual([])
  })

  it("includes in-flight uploads", () => {
    expect(
      mediaTypeTagsForAttachments([
        attachment({ mediaType: "video", status: "uploading" }),
      ]),
    ).toEqual(["videos"])
  })
})

describe("reconcileTagsWithMediaTypes", () => {
  it("adds missing media tags and keeps manual tags", () => {
    expect(
      reconcileTagsWithMediaTypes(["family", "travel"], ["photos"]),
    ).toEqual(["family", "photos", "travel"])
  })

  it("removes media tags that no longer have attachments", () => {
    expect(
      reconcileTagsWithMediaTypes(
        ["family", "photos", "videos"],
        ["videos"],
      ),
    ).toEqual(["family", "videos"])
  })

  it("clears all managed tags when no media remains", () => {
    expect(
      reconcileTagsWithMediaTypes(["family", "photos", "gifs"], []),
    ).toEqual(["family"])
  })
})
