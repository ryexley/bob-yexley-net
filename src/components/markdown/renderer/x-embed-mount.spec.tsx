import { render, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MarkdownRenderer } from "./index"

const createTweet = vi.fn()

vi.mock("@/components/markdown/x/x-widgets", () => ({
  tweetWidgetOptions: (width: number) => ({
    theme: "dark",
    dnt: true,
    conversation: "none",
    width,
  }),
  loadTwitterWidgets: () =>
    Promise.resolve({
      widgets: { createTweet },
      ready: vi.fn(),
    }),
}))

afterEach(() => {
  createTweet.mockReset()
})

describe("MarkdownRenderer X embeds", () => {
  it("mounts a pasted X status URL as an embed", async () => {
    createTweet.mockResolvedValue(document.createElement("iframe"))

    render(() => (
      <MarkdownRenderer content="https://x.com/stephenthompson/status/1234567890" />
    ))

    await waitFor(() => {
      expect(document.querySelector(".x-embed")).toBeTruthy()
    })

    await waitFor(() => {
      expect(createTweet).toHaveBeenCalledWith(
        "1234567890",
        expect.any(HTMLElement),
        expect.objectContaining({ theme: "dark" }),
      )
    })
  })
})
