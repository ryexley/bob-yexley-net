import { fireEvent, render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { ComposerMediaChrome } from "./composer-media-chrome"
import type { Attachment, MediaStore } from "./media-store"
import { MEDIA_PLACEMENT, type MediaPlacement } from "./placement"

const attachment = (key: string, placement?: MediaPlacement): Attachment => ({
  key,
  previewUrl: `blob:${key}`,
  status: "saved",
  mediaType: "image",
  ...(placement ? { placement } : {}),
})

/**
 * Only the members this component reaches for. `mediaStore` is a large surface
 * and its write path is covered in `media-store.spec.ts`.
 */
const stubStore = (
  attachments: Attachment[],
  overrides: Partial<MediaStore> = {},
): MediaStore =>
  ({
    attachments: () => attachments,
    removeAttachment: vi.fn(async () => undefined),
    retry: vi.fn(),
    ...overrides,
  }) as unknown as MediaStore

const renderChrome = (options: {
  store?: MediaStore | null
  error?: string | null
  onRemoveAttachment?: (key: string) => void | Promise<void>
}) =>
  render(() => (
    <ComposerMediaChrome
      media={() => options.store ?? null}
      mediaError={() => options.error ?? null}
      onPreview={vi.fn()}
      onRemoveAttachment={options.onRemoveAttachment}
    />
  ))

describe("ComposerMediaChrome", () => {
  describe("error surfacing", () => {
    /**
     * Regression: every `blip_media` insert failed for two days with
     * `column "placement" does not exist` after a migration shipped unapplied.
     * `mediaStore` reported it through `persistError` and this is the only place
     * it reaches the author, so the alert must render verbatim.
     */
    it("renders a persist failure as an assertive alert", () => {
      const { container } = renderChrome({
        store: stubStore([attachment("a")]),
        error: 'column "placement" does not exist',
      })

      const alert = container.querySelector(".blip-editor-media-error")
      expect(alert).toBeTruthy()
      expect(alert?.getAttribute("role")).toBe("alert")
      expect(alert?.textContent).toBe('column "placement" does not exist')
    })

    it("renders no alert element while there is no error", () => {
      const { container } = renderChrome({
        store: stubStore([attachment("a")]),
        error: null,
      })

      expect(container.querySelector(".blip-editor-media-error")).toBeNull()
    })

    it("surfaces an error even when nothing attached successfully", () => {
      const { container } = renderChrome({
        store: stubStore([]),
        error: "Failed to save media record",
      })

      expect(
        container.querySelector(".blip-editor-media-error")?.textContent,
      ).toBe("Failed to save media record")
    })
  })

  describe("attachment filtering", () => {
    it("excludes inline attachments, which render inside the document", () => {
      const { container } = renderChrome({
        store: stubStore([
          attachment("gallery-1", MEDIA_PLACEMENT.Gallery),
          attachment("inline-1", MEDIA_PLACEMENT.Inline),
          attachment("gallery-2", MEDIA_PLACEMENT.Gallery),
        ]),
      })

      expect(
        container.querySelectorAll(".media-thumbnail-strip-item"),
      ).toHaveLength(2)
    })

    it("keeps attachments with no placement recorded", () => {
      const { container } = renderChrome({
        store: stubStore([attachment("legacy")]),
      })

      expect(
        container.querySelectorAll(".media-thumbnail-strip-item"),
      ).toHaveLength(1)
    })

    it("hides the strip when every attachment is inline", () => {
      const { container } = renderChrome({
        store: stubStore([attachment("inline-1", MEDIA_PLACEMENT.Inline)]),
      })

      expect(container.querySelector(".media-thumbnail-strip")).toBeNull()
    })
  })

  describe("removal", () => {
    it("delegates to the override when the caller supplies one", async () => {
      const removeAttachment = vi.fn(async () => undefined)
      const onRemoveAttachment = vi.fn()
      const { getByLabelText } = renderChrome({
        store: stubStore([attachment("a")], { removeAttachment }),
        onRemoveAttachment,
      })

      await fireEvent.click(getByLabelText("Remove attachment"))

      // The root editor overrides removal to keep its media-type tags in sync,
      // so the store must not also be called directly.
      expect(onRemoveAttachment).toHaveBeenCalledWith("a")
      expect(removeAttachment).not.toHaveBeenCalled()
    })

    it("falls back to the store when no override is supplied", async () => {
      const removeAttachment = vi.fn(async () => undefined)
      const { getByLabelText } = renderChrome({
        store: stubStore([attachment("a")], { removeAttachment }),
      })

      await fireEvent.click(getByLabelText("Remove attachment"))

      expect(removeAttachment).toHaveBeenCalledWith("a")
    })
  })

  describe("retry", () => {
    it("delegates a failed upload retry to the store", async () => {
      const retry = vi.fn()
      const { getByLabelText } = renderChrome({
        store: stubStore([{ ...attachment("a"), status: "error" as const }], {
          retry,
        }),
      })

      await fireEvent.click(getByLabelText("Retry upload"))

      expect(retry).toHaveBeenCalledWith("a")
    })
  })

  describe("without a media store", () => {
    it("renders its container rather than throwing", () => {
      const { container } = renderChrome({ store: null })

      expect(container.querySelector(".blip-editor-media-chrome")).toBeTruthy()
      expect(container.querySelector(".media-thumbnail-strip")).toBeNull()
    })
  })
})
