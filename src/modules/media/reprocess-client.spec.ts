import { describe, expect, it, vi } from "vitest"
import { reprocessAllFailedMedia } from "./reprocess-client"

const ok = (
  reprocessed: string[],
  failed: Array<{ id: string; error: string }>,
  remaining: number,
) => ({
  data: { reprocessed, failed, remaining },
  error: null,
  status: 200,
})

describe("reprocessAllFailedMedia", () => {
  it("loops batches until nothing is left", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok(["a", "b"], [], 2))
      .mockResolvedValueOnce(ok(["c", "d"], [], 0))
    const onProgress = vi.fn()
    const result = await reprocessAllFailedMedia(onProgress, fetcher)
    expect(result).toEqual({ reprocessed: 4, failed: [], remaining: 0 })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledTimes(2)
  })

  it("excludes rows that failed and stops when only they remain", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok(["a"], [{ id: "bad", error: "gone" }], 2))
      .mockResolvedValueOnce(ok(["b"], [], 1))
    const result = await reprocessAllFailedMedia(undefined, fetcher)
    expect(fetcher).toHaveBeenNthCalledWith(2, ["bad"])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.reprocessed).toBe(2)
    expect(result.failed).toEqual([{ id: "bad", error: "gone" }])
  })

  it("stops on an empty batch", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok([], [], 0))
    await reprocessAllFailedMedia(undefined, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("throws on an auth error", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ data: null, error: "Forbidden", status: 403 })
    await expect(reprocessAllFailedMedia(undefined, fetcher)).rejects.toThrow(
      "Forbidden",
    )
  })
})
