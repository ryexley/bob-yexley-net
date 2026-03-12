import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { createSignal, For, splitProps } from "solid-js"
import { Blip } from "@/modules/blips/components/blip"
import { BlipEditor } from "@/modules/blips/components/blip-editor"
import "./blips.css"

export function Blips(props: {
  blips: BlipType[]
  onView?: (blipId: string) => void
}) {
  const [local] = splitProps(props, ["blips", "onView"])
  const [showBlipEditor, setShowBlipEditor] = createSignal(false)
  const [selectedBlipId, setSelectedBlipId] = createSignal<string | null>(null)

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
              tags={blip.tags ?? []}
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
