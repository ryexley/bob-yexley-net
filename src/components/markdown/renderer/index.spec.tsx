import { render, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownRenderer } from "./index"

beforeEach(() => {
  vi.stubEnv("VITE_MEDIA_STORAGE_URL", "https://cdn.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("MarkdownRenderer media mounts", () => {
  it("keeps a mounted still when media rows arrive after first paint", async () => {
    const [media, setMedia] = createSignal<
      Array<{ storage_key: string; width: number; height: number }>
    >([])

    render(() => (
      <MarkdownRenderer
        content='{media:{key:"media/u/b/shot",type:"image",mime:"image/jpeg"}}'
        media={media() as never}
      />
    ))

    await waitFor(() => {
      expect(document.querySelector(".media-embed")).toBeTruthy()
    })

    const embed = document.querySelector(".media-embed")
    const image = document.querySelector(".media") as HTMLImageElement
    expect(image.getAttribute("src")).toContain("media/u/b/shot")

    setMedia([
      {
        storage_key: "media/u/b/shot",
        width: 800,
        height: 600,
      },
    ])

    await waitFor(() => {
      const frame = document.querySelector(
        ".personal-cloud-image",
      ) as HTMLElement
      expect(frame?.style.aspectRatio).toBe("800 / 600")
    })

    expect(document.querySelector(".media-embed")).toBe(embed)
    expect(document.querySelector(".media")).toBe(image)
    expect(image.getAttribute("src")).toContain("media/u/b/shot")
  })
})
