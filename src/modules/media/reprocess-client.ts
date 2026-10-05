import { api } from "@/urls"
import type { MediaResult } from "./types"
import type { ReprocessFailedMediaResponse } from "./reprocess"

export type ReprocessProgress = {
  reprocessed: number
  failed: Array<{ id: string; error: string }>
  remaining: number
}

type Fetcher = (
  excludeIds: string[],
) => Promise<MediaResult<ReprocessFailedMediaResponse>>

const defaultFetcher: Fetcher = async excludeIds => {
  const response = await fetch(api.media.reprocessFailed, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ excludeIds }),
  })
  try {
    return (await response.json()) as MediaResult<ReprocessFailedMediaResponse>
  } catch {
    return {
      data: null,
      error: `Request failed (${response.status})`,
      status: response.status,
    }
  }
}

/**
 * Drive `/api/media/reprocess-failed` batch by batch until nothing is left
 * that hasn't already failed in this run. Rows that fail are excluded from
 * later batches so one bad original can't stall the rest. Throws on an
 * auth/server error so the caller can surface it.
 */
export async function reprocessAllFailedMedia(
  onProgress: (progress: ReprocessProgress) => void = () => {},
  fetcher: Fetcher = defaultFetcher,
): Promise<ReprocessProgress> {
  const progress: ReprocessProgress = {
    reprocessed: 0,
    failed: [],
    remaining: 0,
  }
  // Hard stop well past the 31 rows this exists for, in case the server
  // keeps returning work without progress.
  for (let batch = 0; batch < 100; batch += 1) {
    const result = await fetcher(progress.failed.map(item => item.id))
    if (!result.data) {
      throw new Error(result.error ?? `Request failed (${result.status})`)
    }
    const { reprocessed, failed, remaining } = result.data
    progress.reprocessed += reprocessed.length
    progress.failed.push(...failed)
    progress.remaining = remaining
    onProgress({ ...progress, failed: [...progress.failed] })
    if (reprocessed.length === 0 && failed.length === 0) {
      break
    }
    if (remaining <= progress.failed.length) {
      break
    }
  }
  return progress
}
