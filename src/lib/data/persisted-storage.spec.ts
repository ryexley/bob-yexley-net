import { beforeEach, describe, expect, it, vi } from "vitest"
import { persistedStorage } from "@/lib/data/persisted-storage"

describe("persistedStorage", () => {
  const key = "persisted-storage-test"

  beforeEach(async () => {
    localStorage.removeItem(key)
    await persistedStorage.flush(key)
    vi.restoreAllMocks()
  })

  it("returns pending values from memory before they flush", () => {
    void persistedStorage.setItem(key, { value: "draft" })

    expect(persistedStorage.getItem<{ value: string }>(key)).toEqual({
      value: "draft",
    })
  })

  it("coalesces rapid writes to the same key", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem")

    const firstWrite = persistedStorage.setItem(key, { value: "first" })
    const secondWrite = persistedStorage.setItem(key, { value: "second" })

    await persistedStorage.flush(key)
    await Promise.all([firstWrite, secondWrite])

    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual({
      value: "second",
    })
  })
})
