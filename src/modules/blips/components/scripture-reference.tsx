import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  splitProps,
  type ParentProps,
} from "solid-js"
import { Drawer, DrawerPosition } from "@/components/drawer"
import { Tooltip } from "@/components/tooltip"
import {
  ScripturePassagePanel,
  type PassageState,
} from "@/modules/blips/components/scripture-passage-panel"
import { cx } from "@/util"
import { withWindow } from "@/util/browser"
import "./scripture-reference.css"

const SCRIPTURE_REFERENCE_MOBILE_MAX_WIDTH = 640
const DRAWER_CLOSE_ANIMATION_MS = 500

const scriptureReferenceDrawerBehavior = {
  snapPoints: [0, 0.5, 1],
  breakPoints: [null, null],
  defaultSnapPoint: 0.5,
  closeOnOutsidePointer: true,
} as const

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

function ScriptureReferenceTooltip(props: ScriptureReferenceProps) {
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

function ScriptureReferenceMobileDrawer(props: ScriptureReferenceProps) {
  const [local] = splitProps(props, [
    "book",
    "chapter",
    "startVerse",
    "endVerse",
    "normalized",
    "children",
  ])
  const [open, setOpen] = createSignal(false)
  const [isMounted, setIsMounted] = createSignal(false)
  const [sheetSnap, setSheetSnap] = createSignal<"half" | "full">("half")
  const [passage, setPassage] = createSignal<PassageState>({ status: "idle" })
  let closeUnmountTimeout: ReturnType<typeof setTimeout> | null = null

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

  const clearCloseUnmountTimeout = () => {
    if (closeUnmountTimeout) {
      clearTimeout(closeUnmountTimeout)
      closeUnmountTimeout = null
    }
  }

  createEffect(() => {
    if (open()) {
      clearCloseUnmountTimeout()
      setIsMounted(true)
      setSheetSnap("half")
      return
    }

    if (!isMounted()) {
      return
    }

    clearCloseUnmountTimeout()
    closeUnmountTimeout = setTimeout(() => {
      setIsMounted(false)
      closeUnmountTimeout = null
    }, DRAWER_CLOSE_ANIMATION_MS)
  })

  onCleanup(() => {
    clearCloseUnmountTimeout()
  })

  const handleOpen = () => {
    setOpen(true)
    void fetchPassage()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

  return (
    <>
      <ScriptureReferenceTrigger onClick={handleOpen}>
        {local.children}
      </ScriptureReferenceTrigger>
      <Show when={isMounted()}>
        <Drawer
          side={DrawerPosition.BOTTOM}
          open={open()}
          onOpenChange={handleOpenChange}
          showTrigger={false}
          drawerProps={{
            ...scriptureReferenceDrawerBehavior,
            onActiveSnapPointChange: point => {
              if (point === 1) {
                setSheetSnap("full")
                return
              }

              if (point === 0.5) {
                setSheetSnap("half")
              }
            },
          }}
          class="scripture-reference-drawer"
          contentClass="scripture-reference-drawer-content">
          <div class="scripture-reference-drawer-frame">
            <div
              class="scripture-reference-drawer-sheet"
              data-snap={sheetSnap()}>
              <div class="scripture-reference-drawer-handle-zone">
                <div
                  class="scripture-reference-drawer-handle"
                  aria-hidden="true"
                />
              </div>
              <div
                class="scripture-reference-drawer-body"
                data-corvu-no-drag>
                <header class="scripture-reference-drawer-header">
                  <h2 class="scripture-reference-drawer-title">
                    {local.normalized}
                  </h2>
                </header>
                <div class="scripture-reference-drawer-shell">
                  <ScripturePassagePanel
                    reference={local.normalized}
                    showReference={false}
                    state={passage()}
                  />
                </div>
              </div>
            </div>
          </div>
        </Drawer>
      </Show>
    </>
  )
}

function useIsMobileViewport() {
  const readIsMobile = () =>
    withWindow(
      window => window.innerWidth <= SCRIPTURE_REFERENCE_MOBILE_MAX_WIDTH,
      () => false,
    )
  const [isMobile, setIsMobile] = createSignal(readIsMobile())

  onMount(() => {
    const updateIsMobile = () => {
      setIsMobile(readIsMobile())
    }

    updateIsMobile()
    window.addEventListener("resize", updateIsMobile, { passive: true })
    onCleanup(() => window.removeEventListener("resize", updateIsMobile))
  })

  return isMobile
}

export function ScriptureReference(props: ScriptureReferenceProps) {
  const isMobile = useIsMobileViewport()

  return (
    <Show
      when={isMobile()}
      fallback={<ScriptureReferenceTooltip {...props} />}>
      <ScriptureReferenceMobileDrawer {...props} />
    </Show>
  )
}

export { requestPassage }
