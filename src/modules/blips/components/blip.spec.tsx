import { render } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  Blip as BlipCard,
  splitBlipCardTags,
} from "@/modules/blips/components/blip"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: any }) => (
    <a href={props.href}>{props.children}</a>
  ),
  useNavigate: () => vi.fn(),
  usePreloadRoute: () => vi.fn(),
}))

vi.mock("@/components/notification", () => ({
  useNotify: () => ({ error: vi.fn() }),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: () => false,
    userProfile: () => null,
    userSystem: () => null,
  }),
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({ client: {} }),
}))

vi.mock("@/modules/blips/data/store", () => ({
  blipStore: () => ({
    updateCachedReactionState: vi.fn(),
  }),
}))

vi.mock("@/modules/blips/data/reactions-store", () => ({
  reactionStore: () => ({
    toggleReaction: vi.fn(),
  }),
}))

vi.mock("@/components/tooltip", () => ({
  Tooltip: (props: { children: any }) => <>{props.children}</>,
}))

vi.mock("@/components/markdown/renderer", () => ({
  MarkdownRenderer: (props: { content: string }) => <div>{props.content}</div>,
}))

vi.mock("@/modules/blips/components/blip-actions", () => ({
  BlipActions: () => <div data-testid="blip-actions" />,
}))

vi.mock("@/modules/blips/components/blip-reaction-trigger", () => ({
  BlipReactionTrigger: () => null,
}))

vi.mock("@/modules/blips/components/blip-reaction-summary", () => ({
  BlipReactionSummary: () => null,
}))

vi.mock("@/i18n", () => ({
  ptr: () => (key: string, values?: { count?: number }) => {
    if (key === "tags.overflow") {
      return `+${values?.count}`
    }
    if (key === "tags.overflowAriaLabel") {
      return `${values?.count} more tags`
    }
    return key
  },
}))

vi.mock("@/modules/blips/util", async importOriginal => {
  const actual = await importOriginal<typeof import("@/modules/blips/util")>()
  return {
    ...actual,
    formatBlipTimestamp: () => "3 months ago",
    formatBlipTimestampTooltip: () => "3 months ago",
  }
})

const makeBlip = (overrides: Partial<Blip> = {}): Blip => ({
  id: "blip-1",
  title: null,
  content: "Scripture References",
  user_id: "user-1",
  parent_id: null,
  blip_type: BLIP_TYPES.ROOT,
  updates_count: 0,
  published: true,
  moderation_status: "approved",
  tags: [],
  reactions_count: 0,
  my_reaction_count: 0,
  reactions: [],
  created_at: "2026-06-05T12:00:00.000Z",
  updated_at: "2026-06-05T12:00:00.000Z",
  ...overrides,
})

describe("splitBlipCardTags", () => {
  it("returns all tags and no overflow when there are three or fewer", () => {
    expect(splitBlipCardTags(["baseball", "blips", "faith"])).toEqual({
      visible: ["baseball", "blips", "faith"],
      overflowCount: 0,
    })
  })

  it("keeps the first three tags and counts the rest", () => {
    expect(
      splitBlipCardTags([
        "baseball",
        "blips",
        "church-notes",
        "college-sports",
        "faith",
        "personal",
        "scripture",
        "concord-christian",
      ]),
    ).toEqual({
      visible: ["baseball", "blips", "church-notes"],
      overflowCount: 5,
    })
  })

  it("treats a missing tag list as empty", () => {
    expect(splitBlipCardTags(undefined)).toEqual({
      visible: [],
      overflowCount: 0,
    })
  })
})

describe("Blip card tags", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows only the first three tags plus a leftover-count badge", () => {
    const tags = [
      "baseball",
      "blips",
      "church-notes",
      "college-sports",
      "faith",
      "personal",
      "scripture",
      "concord-christian",
    ]
    render(() => <BlipCard blip={makeBlip()} tags={tags} />)

    const tagLinks = document.querySelectorAll(".blip-card .tag-list .tag a")
    expect([...tagLinks].map(link => link.textContent)).toEqual([
      "baseball",
      "blips",
      "church-notes",
    ])
    expect(document.querySelector(".blip-card .tag-list .overflow")?.textContent).toBe(
      "+5",
    )
  })

  it("does not render an overflow badge when there are three or fewer tags", () => {
    render(() => (
      <BlipCard blip={makeBlip()} tags={["baseball", "blips", "faith"]} />
    ))

    expect(document.querySelectorAll(".blip-card .tag-list .tag")).toHaveLength(3)
    expect(document.querySelector(".blip-card .tag-list .overflow")).toBeNull()
  })
})
