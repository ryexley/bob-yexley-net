import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { createEffect, createMemo, createSignal, For, splitProps } from "solid-js"
import { Blip } from "@/modules/blips/components/blip"
import { BlipEditor } from "@/modules/blips/components/blip-editor"
import { useAuth } from "@/context/auth-context"
import { useSupabase } from "@/context/services-context"
import { tagStore } from "@/modules/blips/data"
import "./blips.css"

export function Blips(props: {
  blips: BlipType[]
  onView?: (blipId: string) => void
}) {
  const [local] = splitProps(props, ["blips", "onView"])
  const { isAuthenticated } = useAuth() as any
  const supabase = useSupabase()
  const tags = tagStore(supabase.client)
  const [showBlipEditor, setShowBlipEditor] = createSignal(false)
  const [selectedBlipId, setSelectedBlipId] = createSignal<string | null>(null)
  const [hydratedTagsByBlipId, setHydratedTagsByBlipId] = createSignal<
    Record<string, string[]>
  >({})
  let activeHydrationRequest = 0

  const tagHydrationBlipIds = createMemo(() => {
    if (!isAuthenticated()) {
      return []
    }

    return local.blips
      .filter(blip => !blip.published && (blip.tags?.length ?? 0) === 0)
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
    setSelectedBlipId(blipId)
    setShowBlipEditor(true)
  }

  const closeEditor = () => {
    setShowBlipEditor(false)
    setSelectedBlipId(null)
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
      <BlipEditor
        open={showBlipEditor()}
        blipId={selectedBlipId()}
        onPanelOpenChange={open => {
          setShowBlipEditor(open)
          if (!open) {
            setSelectedBlipId(null)
          }
        }}
        close={closeEditor}
      />
    </>
  )
}
