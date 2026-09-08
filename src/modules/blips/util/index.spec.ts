import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  compareBlipsByPublishTimestampDesc,
  formatBlipDateGroupLabel,
  formatBlipScheduledTimestamp,
  formatBlipTimestampTooltip,
  getBlipDateGroupKey,
  getBlipPublishTimestamp,
  groupBlipsByDate,
  isBlipPubliclyVisible,
  isBlipScheduled,
  isComposerFkStubUpdate,
  isUpdateActivityVisible,
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

describe("isUpdateActivityVisible", () => {
  it("hides unpublished textless updates", () => {
    expect(
      isUpdateActivityVisible({
        published: false,
        content: "",
      } as any),
    ).toBe(false)

    expect(
      isUpdateActivityVisible({
        published: false,
        content: "   ",
      } as any),
    ).toBe(false)
  })

  it("shows unpublished updates once they have saved content", () => {
    expect(
      isUpdateActivityVisible({
        published: false,
        content: "Draft update",
      } as any),
    ).toBe(true)
  })

  it("shows published updates even when content is empty", () => {
    expect(
      isUpdateActivityVisible({
        published: true,
        content: "",
      } as any),
    ).toBe(true)
  })
})

describe("isComposerFkStubUpdate", () => {
  it("identifies unpublished textless update rows", () => {
    expect(
      isComposerFkStubUpdate({
        blip_type: "update",
        published: false,
        content: "",
      } as any),
    ).toBe(true)
  })

  it("does not treat saved or published updates as stubs", () => {
    expect(
      isComposerFkStubUpdate({
        blip_type: "update",
        published: false,
        content: "Saved draft",
      } as any),
    ).toBe(false)

    expect(
      isComposerFkStubUpdate({
        blip_type: "update",
        published: true,
        content: "",
      } as any),
    ).toBe(false)
  })
})

describe("blip date groups", () => {
  const now = new Date("2026-04-22T16:00:00.000Z")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keys groups by the local calendar day of the publish timestamp", () => {
    expect(
      getBlipDateGroupKey({
        publish_at: "2026-04-22T16:00:00.000Z",
        created_at: "2026-04-20T16:00:00.000Z",
      } as any),
    ).toBe("2026-04-22")
  })

  it("uses relative labels for recent days and calendar dates after that", () => {
    expect(formatBlipDateGroupLabel("2026-04-22", now)).toBe("Today")
    expect(formatBlipDateGroupLabel("2026-04-21", now)).toBe("Yesterday")
    expect(formatBlipDateGroupLabel("2026-04-20", now)).toBe("Monday")
    expect(formatBlipDateGroupLabel("2026-04-10", now)).toBe("April 10")
    expect(formatBlipDateGroupLabel("2025-08-20", now)).toBe("August 20, 2025")
  })

  it("groups a sorted feed and keeps newest days first", () => {
    const groups = groupBlipsByDate(
      [
        {
          id: "older-same-day",
          publish_at: "2026-04-21T14:00:00.000Z",
          created_at: "2026-04-21T14:00:00.000Z",
        },
        {
          id: "today",
          publish_at: "2026-04-22T16:00:00.000Z",
          created_at: "2026-04-22T16:00:00.000Z",
        },
        {
          id: "newer-same-day",
          publish_at: "2026-04-21T18:00:00.000Z",
          created_at: "2026-04-21T18:00:00.000Z",
        },
      ] as any[],
      now,
    )

    expect(groups.map(group => group.label)).toEqual(["Today", "Yesterday"])
    expect(groups[0]?.blips.map(blip => blip.id)).toEqual(["today"])
    expect(groups[1]?.blips.map(blip => blip.id)).toEqual([
      "newer-same-day",
      "older-same-day",
    ])
  })
})
