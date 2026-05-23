import { createSignal, splitProps, type ParentProps } from "solid-js"
import { Tooltip } from "@/components/tooltip"
import {
  ScripturePassagePanel,
  type PassageState,
} from "@/modules/blips/components/scripture-passage-panel"
import { cx } from "@/util"
import "./scripture-reference.css"

export type ScriptureReferenceProps = ParentProps<{
  book: string
  chapter: number
  startVerse: number
  endVerse?: number | null
  normalized: string
}>

export type ScriptureReferenceTriggerProps = ParentProps<{
  class?: string
  onPointerEnter?: (event: PointerEvent) => void
  onFocus?: (event: FocusEvent) => void
  onClick?: (event: MouseEvent) => void
}>

export function ScriptureReferenceTrigger(props: ScriptureReferenceTriggerProps) {
  const [local] = splitProps(props, [
    "class",
    "children",
    "onPointerEnter",
    "onFocus",
    "onClick",
  ])

  return (
    <span
      class={cx("scripture-reference-trigger", local.class)}
      onPointerEnter={local.onPointerEnter}
      onFocus={local.onFocus}
      onClick={local.onClick}>
      {local.children}
    </span>
  )
}

async function requestPassage(
  props: Pick<
    ScriptureReferenceProps,
    "book" | "chapter" | "startVerse" | "endVerse"
  >,
): Promise<PassageState> {
  const params = new URLSearchParams({
    book: props.book,
    chapter: String(props.chapter),
    start_verse: String(props.startVerse),
    ...(props.endVerse ? { end_verse: String(props.endVerse) } : {}),
  })

  try {
    const response = await fetch(`/api/bible/passage?${params}`)
    if (!response.ok) {
      throw new Error("Passage request failed")
    }

    const data = (await response.json()) as { passage?: string }
    if (!data.passage) {
      throw new Error("Passage missing from response")
    }

    return {
      status: "loaded",
      text: data.passage,
    }
  } catch {
    return { status: "error" }
  }
}

export function ScriptureReference(props: ScriptureReferenceProps) {
  const [local] = splitProps(props, [
    "book",
    "chapter",
    "startVerse",
    "endVerse",
    "normalized",
    "children",
  ])
  const [passage, setPassage] = createSignal<PassageState>({ status: "idle" })

  const fetchPassage = async () => {
    if (passage().status !== "idle") {
      return
    }

    setPassage({ status: "loading" })

    const result = await requestPassage({
      book: local.book,
      chapter: local.chapter,
      startVerse: local.startVerse,
      endVerse: local.endVerse,
    })

    setPassage(result)
  }

  const handleOpenIntent = () => {
    void fetchPassage()
  }

  return (
    <Tooltip
      touchMode="popover"
      touchFullWidth
      placement="bottom"
      openDelay={200}
      contentClass="scripture-reference-content"
      content={() => (
        <ScripturePassagePanel
          reference={local.normalized}
          state={passage()}
        />
      )}>
      <ScriptureReferenceTrigger
        onPointerEnter={handleOpenIntent}
        onFocus={handleOpenIntent}
        onClick={handleOpenIntent}>
        {local.children}
      </ScriptureReferenceTrigger>
    </Tooltip>
  )
}

export { requestPassage }
