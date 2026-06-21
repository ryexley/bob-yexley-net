import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { createEffect, createMemo, createSignal, For, splitProps } from "solid-js"
import { Blip } from "@/modules/blips/components/blip"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { tagStore } from "@/modules/blips/data"
import {
  flattenBlipPageMedia,
  getBlipMediaFor,
  getUpdateBlipIdsForRoots,
  groupMediaByBlipId,
  type BlipMediaRow,
} from "@/modules/media/data/queries"
import { useOptionalBlipComposer } from "@/modules/blips/context/blip-composer-context"
import { compareBlipsByPublishTimestampDesc } from "@/modules/blips/util"
import "./blips.css"

export function Blips(props: {
  blips: BlipType[]
  onView?: (blipId: string) => void
}) {
  const [local] = splitProps(props, ["blips", "onView"])
  const { isAuthenticated } = useAuth() as any
  const supabase = useSupabase()
  const tags = tagStore(supabase.client)
  const composer = useOptionalBlipComposer()
  const [hydratedTagsByBlipId, setHydratedTagsByBlipId] = createSignal<
    Record<string, string[]>
  >({})
  let activeHydrationRequest = 0
  // Phase 7 feed media: batch-load committed `blip_media` for the rendered
  // blips and key it by id (handoff fork 1). Mirrors the tag-hydration pattern
  // below — fetch only the ids not yet loaded so `loadMore` pages append
  // incrementally instead of refetching the whole set.
  const [mediaByBlipId, setMediaByBlipId] = createSignal<
    Record<string, BlipMediaRow[]>
  >({})
  const [updateIdsByRootId, setUpdateIdsByRootId] = createSignal<
    Record<string, string[]>
  >({})
  const [loadedMediaIds, setLoadedMediaIds] = createSignal<Set<string>>(
    new Set(),
  )
  let activeMediaRequest = 0

  const tagHydrationBlipIds = createMemo(() => {
    if (!isAuthenticated()) {
      return []
    }

    return local.blips
      .filter(blip => !blip.published && blip.tags === undefined)
      .map(blip => blip.id)
  })

  createEffect(() => {
    const ids = tagHydrationBlipIds()
    if (ids.length === 0) {
      return
    }

    const requestId = ++activeHydrationRequest
    void (async () => {
      const result = await tags.getBlipTagValuesByBlipIds(ids)
      if (requestId !== activeHydrationRequest || result.error || !result.data) {
        return
      }

      setHydratedTagsByBlipId(current => ({
        ...current,
        ...result.data,
      }))
    })()
  })

  const mediaPendingBlipIds = createMemo(() => {
    const loaded = loadedMediaIds()
    return [
      ...new Set(local.blips.map(blip => blip.id).filter(Boolean)),
    ].filter(id => !loaded.has(id))
  })

  createEffect(() => {
    const ids = mediaPendingBlipIds()
    if (ids.length === 0) {
      return
    }

    const requestId = ++activeMediaRequest
    void (async () => {
      const blipsById = new Map(local.blips.map(blip => [blip.id, blip]))
      const rootsNeedingUpdateIds = ids.filter(
        id => (blipsById.get(id)?.updates_count ?? 0) > 0,
      )
      const updateIdsByRoot =
        rootsNeedingUpdateIds.length > 0
          ? await getUpdateBlipIdsForRoots(rootsNeedingUpdateIds)
          : {}
      const mediaBlipIds = [
        ...new Set([...ids, ...Object.values(updateIdsByRoot).flat()]),
      ]
      const rows = await getBlipMediaFor(mediaBlipIds)
      if (requestId !== activeMediaRequest) {
        return
      }

      const grouped = groupMediaByBlipId(rows)
      setMediaByBlipId(current => ({ ...current, ...grouped }))
      setUpdateIdsByRootId(current => ({ ...current, ...updateIdsByRoot }))
      // Mark every requested id as loaded — including those with no media —
      // so we never refetch a blip that simply has no attachments.
      setLoadedMediaIds(current => {
        const next = new Set(current)
        for (const id of ids) {
          next.add(id)
        }
        return next
      })
    })()
  })

  const feedCardMediaFor = (rootBlipId: string) => {
    const byBlip = mediaByBlipId()
    return flattenBlipPageMedia(
      byBlip[rootBlipId] ?? [],
      byBlip,
      updateIdsByRootId()[rootBlipId] ?? [],
    )
  }

  const handleEdit = (blipId: string) => {
    composer?.openEditRoot(blipId)
  }

  const sortedBlips = createMemo(() =>
    [...local.blips].sort(compareBlipsByPublishTimestampDesc),
  )

  return (
    <>
      <ul class="blips">
        <For each={sortedBlips()}>
          {blip => (
            <Blip
              blip={blip}
              tags={
                (blip.tags?.length ?? 0) > 0
                  ? blip.tags ?? []
                  : hydratedTagsByBlipId()[blip.id] ?? []
              }
              media={feedCardMediaFor(blip.id)}
              onEdit={handleEdit}
              onView={local.onView}
            />
          )}
        </For>
      </ul>
    </>
  )
}
