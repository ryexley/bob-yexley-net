import { fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MediaButton } from "./media-button"

const setFiles = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", { value: files, configurable: true })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("MediaButton", () => {
  it("opens the native picker when the trigger is clicked", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})

    const { getByLabelText } = render(() => (
      <MediaButton
        onFiles={vi.fn()}
        label="Add media"
      />
    ))

    fireEvent.click(getByLabelText("Add media"))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it("emits selected files via onFiles", () => {
    const onFiles = vi.fn()
    const { container } = render(() => (
      <MediaButton
        onFiles={onFiles}
        label="Add media"
      />
    ))

    const input = container.querySelector(
      "input[type=file]",
    ) as HTMLInputElement
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" })
    setFiles(input, [file])
    fireEvent.change(input)

    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0][0]).toEqual([file])
  })

  it("does not emit when the selection is empty", () => {
    const onFiles = vi.fn()
    const { container } = render(() => (
      <MediaButton
        onFiles={onFiles}
        label="Add media"
      />
    ))

    const input = container.querySelector(
      "input[type=file]",
    ) as HTMLInputElement
    setFiles(input, [])
    fireEvent.change(input)

    expect(onFiles).not.toHaveBeenCalled()
  })
})
