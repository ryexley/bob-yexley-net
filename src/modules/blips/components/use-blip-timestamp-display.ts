import {
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
} from "solid-js"
import type { Blip } from "@/modules/blips/data/schema"
import {
  formatBlipDisplayLabel,
  formatBlipDisplayTooltip,
  getBlipPublishTimestamp,
  isBlipScheduled,
} from "@/modules/blips/util"

type TimestampBlip = Pick<Blip, "published" | "publish_at" | "created_at">

export function useBlipTimestampDisplay(
  blip: Accessor<TimestampBlip | null | undefined>,
  formatScheduledTooltip: (fullTimestamp: string) => string,
) {
  const [clientTimeZoneReady, setClientTimeZoneReady] = createSignal(false)
  const [timeTick, setTimeTick] = createSignal(0)

  onMount(() => {
    setClientTimeZoneReady(true)
    setTimeTick(Date.now())
    const intervalId = setInterval(() => {
      setTimeTick(Date.now())
    }, 60_000)

    onCleanup(() => {
      clearInterval(intervalId)
    })
  })

  const display = createMemo(() => {
    timeTick()
    const current = blip()
    if (!current) {
      return null
    }

    const ready = { clientTimeZoneReady: clientTimeZoneReady() }
    return {
      scheduled: isBlipScheduled(current),
      label: formatBlipDisplayLabel(current, ready),
      tooltip: formatBlipDisplayTooltip(current, formatScheduledTooltip, ready),
      datetime: getBlipPublishTimestamp(current),
    }
  })

  return display
}
