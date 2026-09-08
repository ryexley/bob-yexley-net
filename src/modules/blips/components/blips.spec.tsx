import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { Blips } from "@/modules/blips/components/blips"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: () => false,
  }),
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({ client: {} }),
}))

vi.mock("@/modules/blips/data", () => ({
  tagStore: () => ({
    getBlipTagValuesByBlipIds: vi.fn(),
  }),
}))

vi.mock("@/modules/media/data/queries", () => ({
  flattenBlipPageMedia: () => [],
  getBlipMediaFor: async () => [],
  getUpdateBlipIdsForRoots: async () => ({}),
  groupMediaByBlipId: () => ({}),
}))

vi.mock("@/modules/blips/context/blip-composer-context", () => ({
  useOptionalBlipComposer: () => null,
}))

vi.mock("@/modules/blips/components/blip", () => ({
  Blip: (props: { blip: Blip }) => <li data-blip-id={props.blip.id} />,
}))

const makeBlip = (overrides: Partial<Blip> = {}): Blip => ({
  id: "blip-1",
  title: null,
  content: "Hello",
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
  created_at: "2026-04-21T18:00:00.000Z",
  updated_at: "2026-04-21T18:00:00.000Z",
  publish_at: "2026-04-21T18:00:00.000Z",
  ...overrides,
})

describe("Blips date groups", () => {
  it("renders each day as its own card grid so rows wrap independently", () => {
    render(() => (
      <Blips
        groupByDate
        blips={[
          makeBlip({
            id: "today-1",
            publish_at: "2026-09-08T16:00:00.000Z",
            created_at: "2026-09-08T16:00:00.000Z",
          }),
          makeBlip({
            id: "yesterday-1",
            publish_at: "2026-09-07T18:00:00.000Z",
            created_at: "2026-09-07T18:00:00.000Z",
          }),
          makeBlip({
            id: "yesterday-2",
            publish_at: "2026-09-07T14:00:00.000Z",
            created_at: "2026-09-07T14:00:00.000Z",
          }),
        ]}
      />
    ))

    const list = document.querySelector("ul.blips")
    expect(list?.classList.contains("has-date-groups")).toBe(true)

    const groups = document.querySelectorAll("ul.blips > li.blips-date-group")
    expect(groups).toHaveLength(2)

    const [newerDay, olderDay] = groups
    expect(newerDay?.querySelector(".blips-date-header-label")?.textContent).toBeTruthy()
    expect(
      [...(newerDay?.querySelectorAll("[data-blip-id]") ?? [])].map(
        node => node.getAttribute("data-blip-id"),
      ),
    ).toEqual(["today-1"])
    expect(newerDay?.querySelector("ul.blips-date-cards")).toBeTruthy()

    expect(olderDay?.querySelector(".blips-date-header-label")?.textContent).toBeTruthy()
    expect(
      [...(olderDay?.querySelectorAll("[data-blip-id]") ?? [])].map(
        node => node.getAttribute("data-blip-id"),
      ),
    ).toEqual(["yesterday-1", "yesterday-2"])
    expect(olderDay?.querySelector("ul.blips-date-cards")).toBeTruthy()
  })
})
