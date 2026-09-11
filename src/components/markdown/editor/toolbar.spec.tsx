import { fireEvent, render, screen } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import Toolbar from "./toolbar"

const toolbarProps = {
  visible: true,
  selectedLinkText: "",
  selectedLinkHref: "",
  linkEditorRequestNonce: 0,
  onRequestEditorFocus: () => {},
}

describe("MarkdownEditor Toolbar", () => {
  it("shows image size and align controls when an embed is selected", () => {
    const onFormatApply = vi.fn()

    render(() => (
      <Toolbar
        {...toolbarProps}
        mode="media"
        activeFormats={["media-size-50", "media-align-right"]}
        disabledFormats={[]}
        onFormatApply={onFormatApply}
      />
    ))

    expect(screen.getByRole("toolbar", { name: "Image layout" })).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "50% of column width" })
        .getAttribute("aria-pressed"),
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Align right" })
        .getAttribute("aria-pressed"),
    ).toBe("true")
    expect(screen.queryByLabelText("format_bold")).toBeNull()

    expect(
      screen.getByRole("button", { name: "50% of column width" }).tabIndex,
    ).toBe(-1)
    fireEvent.click(screen.getByRole("button", { name: "25% of column width" }))
    expect(onFormatApply).toHaveBeenCalledWith("media-size-25")
  })

  it("shows the lightbox toggle for images", () => {
    const onFormatApply = vi.fn()

    render(() => (
      <Toolbar
        {...toolbarProps}
        mode="media"
        mediaType="image"
        activeFormats={["media-lightbox"]}
        disabledFormats={[]}
        onFormatApply={onFormatApply}
      />
    ))

    const toggle = screen.getByRole("button", {
      name: "Open full image on click",
    })
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(toggle)
    expect(onFormatApply).toHaveBeenCalledWith("media-lightbox")
  })

  it("hides the lightbox toggle for gifs", () => {
    render(() => (
      <Toolbar
        {...toolbarProps}
        mode="media"
        mediaType="gif"
        activeFormats={[]}
        disabledFormats={[]}
        onFormatApply={() => {}}
      />
    ))

    expect(
      screen.queryByRole("button", { name: "Open full image on click" }),
    ).toBeNull()
  })

  it("restores text formatting controls when no embed is selected", () => {
    const onFormatApply = vi.fn()
    render(() => (
      <Toolbar
        {...toolbarProps}
        mode="text"
        activeFormats={["bold"]}
        disabledFormats={[]}
        onFormatApply={onFormatApply}
      />
    ))

    expect(
      screen.getByRole("toolbar", { name: "Markdown formatting toolbar" }),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Paste" })).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "50% of column width" }),
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Paste" }))
    expect(onFormatApply).toHaveBeenCalledWith("paste")
  })
})
