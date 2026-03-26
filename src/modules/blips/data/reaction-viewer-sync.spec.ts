import { describe, expect, it } from "vitest"
import {
  applyNextViewerReactionState,
  reconcileViewerReactionState,
  removePreviousViewerReactionState,
} from "@/modules/blips/data/reaction-viewer-sync"
import type { BlipReactionSummary } from "@/modules/blips/data/reactions-schema"

const reactions = (items: Partial<BlipReactionSummary>[]): BlipReactionSummary[] =>
  items.map(item => ({
    emoji: item.emoji ?? "🔥",
    count: item.count ?? 1,
    reacted_by_current_user: item.reacted_by_current_user ?? false,
    display_names: item.display_names ?? [],
  }))

describe("reaction-viewer-sync", () => {
  it("removes a pending viewer's private reaction when they log out", () => {
    expect(
      removePreviousViewerReactionState(
        reactions([
          {
            emoji: "🔥",
            count: 1,
            reacted_by_current_user: true,
            display_names: ["Bob"],
          },
        ]),
        {
          id: "visitor-1",
          status: "pending",
          displayName: "Bob",
        },
      ),
    ).toEqual([])
  })

  it("keeps an active viewer's public count but clears ownership on logout", () => {
    expect(
      removePreviousViewerReactionState(
        reactions([
          {
            emoji: "🔥",
            count: 2,
            reacted_by_current_user: true,
            display_names: ["Bob", "Sue"],
          },
        ]),
        {
          id: "visitor-1",
          status: "active",
          displayName: "Bob",
        },
      ),
    ).toEqual(
      reactions([
        {
          emoji: "🔥",
          count: 2,
          reacted_by_current_user: false,
          display_names: ["Bob", "Sue"],
        },
      ]),
    )
  })

  it("adds the next pending viewer's hidden own reaction back into the summary", () => {
    expect(
      applyNextViewerReactionState(
        reactions([
          {
            emoji: "🔥",
            count: 1,
            reacted_by_current_user: false,
            display_names: [],
          },
        ]),
        {
          id: "visitor-1",
          status: "pending",
          displayName: "Bob",
        },
        new Set(["🔥"]),
      ),
    ).toEqual(
      reactions([
        {
          emoji: "🔥",
          count: 2,
          reacted_by_current_user: true,
          display_names: ["Bob"],
        },
      ]),
    )
  })

  it("reconciles logout then login across viewers", () => {
    expect(
      reconcileViewerReactionState({
        reactions: reactions([
          {
            emoji: "🔥",
            count: 1,
            reacted_by_current_user: true,
            display_names: ["Bob"],
          },
        ]),
        previousViewer: {
          id: "visitor-1",
          status: "pending",
          displayName: "Bob",
        },
        nextViewer: {
          id: "visitor-2",
          status: "pending",
          displayName: "Sue",
        },
        ownEmojis: new Set(["🔥"]),
      }),
    ).toEqual(
      reactions([
        {
          emoji: "🔥",
          count: 1,
          reacted_by_current_user: true,
          display_names: ["Sue"],
        },
      ]),
    )
  })
})
