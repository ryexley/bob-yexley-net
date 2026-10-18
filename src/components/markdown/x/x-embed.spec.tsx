import { render, screen, waitFor } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { XEmbed } from "./x-embed"

const createTweet = vi.fn()

vi.mock("./x-widgets", () => ({
  X_TWEET_WIDGET_OPTIONS: {
    theme: "dark",
    dnt: true,
    conversation: "none",
    align: "center",
  },
  loadTwitterWidgets: () =>
    Promise.resolve({
      widgets: { createTweet },
      ready: vi.fn(),
    }),
}))

beforeEach(() => {
  createTweet.mockReset()
  createTweet.mockResolvedValue(document.createElement("iframe"))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("XEmbed", () => {
  it("asks widgets.js to create the tweet and hides the fallback", async () => {
    render(() => (
      <XEmbed
        id="123"
        handle="stephenthompson"
        url="https://x.com/stephenthompson/status/123"
      />
    ))

    expect(screen.getByText("Loading post from X")).toBeTruthy()

    await waitFor(() => {
      expect(createTweet).toHaveBeenCalledWith(
        "123",
        expect.any(HTMLElement),
        expect.objectContaining({ theme: "dark", dnt: true }),
      )
    })

    await waitFor(() => {
      expect(screen.queryByText("Loading post from X")).toBeNull()
    })
  })

  it("keeps a link when the widget cannot be created", async () => {
    createTweet.mockResolvedValue(undefined)

    render(() => (
      <XEmbed
        id="123"
        url="https://x.com/stephenthompson/status/123"
      />
    ))

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "View post on X" })
      expect(link.getAttribute("href")).toBe(
        "https://x.com/stephenthompson/status/123",
      )
    })
  })
})
