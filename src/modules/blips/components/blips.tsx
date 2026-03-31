import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { createEffect, createMemo, createSignal, For, splitProps } from "solid-js"
import { Blip } from "@/modules/blips/components/blip"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { tagStore } from "@/modules/blips/data"
import { useBlipComposer } from "@/modules/blips/context/blip-composer-context"
import "./blips.css"

export function Blips(props: {
  blips: BlipType[]
  onView?: (blipId: string) => void
}) {
  const [local] = splitProps(props, ["blips", "onView"])
  const { isAuthenticated } = useAuth() as any
  const supabase = useSupabase()
  const tags = tagStore(supabase.client)
  const { openEditRoot } = useBlipComposer()
  const [hydratedTagsByBlipId, setHydratedTagsByBlipId] = createSignal<
    Record<string, string[]>
  >({})
  let activeHydrationRequest = 0

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

  const handleEdit = (blipId: string) => {
    openEditRoot(blipId)
  }

  return (
    <>
      <ul class="blips">
        <For each={local.blips}>
          {blip => (
            <Blip
              blip={blip}
              tags={
                (blip.tags?.length ?? 0) > 0
                  ? blip.tags ?? []
                  : hydratedTagsByBlipId()[blip.id] ?? []
              }
              onEdit={handleEdit}
              onView={local.onView}
            />
          )}
        </For>
      </ul>
    </>
  )
}
