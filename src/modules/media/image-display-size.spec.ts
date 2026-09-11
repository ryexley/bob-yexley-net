import { describe, expect, it } from "vitest"
import { readImageDisplaySize } from "./image-display-size"

describe("readImageDisplaySize", () => {
  it("returns null when the file cannot be decoded as an image", async () => {
    const file = new File([new Uint8Array([0, 1, 2])], "not-an-image.jpg", {
      type: "image/jpeg",
    })
    expect(await readImageDisplaySize(file)).toBeNull()
  })
})
