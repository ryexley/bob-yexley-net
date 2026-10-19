"use server"

import type { UpdateHomeHeroImageIdsResult } from "./types"

export async function updateHomeHeroImageIdsRecord(
  imageIds: string[],
): Promise<UpdateHomeHeroImageIdsResult> {
  const { updateHomeHeroImageIds } = await import("./server")
  return updateHomeHeroImageIds(imageIds)
}
