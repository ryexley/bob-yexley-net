import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  compareBlipsByPublishTimestampDesc,
  formatBlipScheduledTimestamp,
  formatBlipTimestampTooltip,
  getBlipPublishTimestamp,
  isBlipPubliclyVisible,
  isBlipScheduled,
} from "@/modules/blips/util"

describe("blip scheduling helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-22T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("prefers publish_at over created_at when deriving the visible timestamp", () => {
    expect(
      getBlipPublishTimestamp({
        publish_at: "2026-04-21T09:30:00.000Z",
        created_at: "2026-04-20T09:30:00.000Z",
      } as any),
    ).toBe("2026-04-21T09:30:00.000Z")
  })

  it("treats future published blips as scheduled and not publicly visible", () => {
    const blip = {
      published: true,
      publish_at: "2026-04-23T12:00:00.000Z",
      created_at: "2026-04-21T12:00:00.000Z",
    } as any

    expect(isBlipScheduled(blip)).toBe(true)
    expect(isBlipPubliclyVisible(blip)).toBe(false)
  })

  it("treats published blips without a future publish_at as publicly visible", () => {
    const blip = {
      published: true,
      publish_at: null,
      created_at: "2026-04-21T12:00:00.000Z",
    } as any

    expect(isBlipScheduled(blip)).toBe(false)
    expect(isBlipPubliclyVisible(blip)).toBe(true)
  })

  it("sorts by effective publish timestamp with created_at as fallback", () => {
    const blips = [
      {
        id: "draft-newer",
        publish_at: null,
        created_at: "2026-04-22T11:00:00.000Z",
      },
      {
        id: "scheduled-earlier-created",
        publish_at: "2026-04-22T11:30:00.000Z",
        created_at: "2026-04-20T11:00:00.000Z",
      },
      {
        id: "published-oldest",
        publish_at: "2026-04-22T10:00:00.000Z",
        created_at: "2026-04-19T11:00:00.000Z",
      },
    ] as any[]

    expect(blips.sort(compareBlipsByPublishTimestampDesc).map(blip => blip.id)).toEqual([
      "scheduled-earlier-created",
      "draft-newer",
      "published-oldest",
    ])
  })

  it("formats scheduled timestamps for explicit scheduled labels", () => {
    expect(formatBlipScheduledTimestamp("2026-04-24T20:10:00.000Z")).toBe(
      "4/24/2026 4:10 PM",
    )
  })

  it("uses the scheduled tooltip copy for future published blips", () => {
    const blip = {
      published: true,
      publish_at: "2026-04-23T12:00:00.000Z",
      created_at: "2026-04-21T12:00:00.000Z",
    } as any

    expect(
      formatBlipTimestampTooltip(blip, fullTimestamp =>
        `Scheduled to be published on ${fullTimestamp}`,
      ),
    ).toBe("Scheduled to be published on April 23rd, 2026 at 8:00 AM")
  })
})
