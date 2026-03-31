import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type ParentProps,
} from "solid-js"
import { debounce } from "@/util/debounce"
import { withWindow } from "@/util/browser"
import { TIME } from "@/util/enums"

const DEFAULT_VIEWPORT_HEIGHT = 1024
const DEFAULT_VIEWPORT_WIDTH = 1280

interface ViewportContextValue {
  height: () => number
  width: () => number
}

const ViewportContext = createContext<ViewportContextValue>()

export function ViewportProvider(props: ParentProps) {
  const [height, setHeight] = createSignal(DEFAULT_VIEWPORT_HEIGHT)
  const [width, setWidth] = createSignal(DEFAULT_VIEWPORT_WIDTH)

  onMount(() => {
    withWindow(window => {
      setHeight(window.innerHeight)
      setWidth(window.innerWidth)
    })

    const handleWindowResize = debounce(() => {
      withWindow(window => {
        setHeight(window.innerHeight)
        setWidth(window.innerWidth)
      })
    }, TIME.QUARTER_SECOND)

    withWindow(window => window.addEventListener("resize", handleWindowResize))

    onCleanup(() => {
      withWindow(window =>
        window.removeEventListener("resize", handleWindowResize),
      )
    })
  })

  return (
    <ViewportContext.Provider value={{ height, width }}>
      {props.children}
    </ViewportContext.Provider>
  )
}

export function useViewport() {
  const context = useContext(ViewportContext)
  if (!context) {
    throw new Error("useViewport must be used within a ViewportProvider")
  }
  return context
}
