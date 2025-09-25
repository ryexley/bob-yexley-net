import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { createSignal, For, Show, splitProps } from "solid-js"
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
              onEdit={handleEdit}
              onView={local.onView}
            />
          )}
        </For>
      </ul>
      <Show when={showBlipEditor()}>
        <BlipEditor
          open={showBlipEditor()}
          blipId={selectedBlipId()}
          onPanelOpenChange={open => {
            const nextOpen = !open
            setShowBlipEditor(nextOpen)
            if (!nextOpen) {
              setSelectedBlipId(null)
            }
          }}
          close={closeEditor}
        />
      </Show>
    </>
  )
}
