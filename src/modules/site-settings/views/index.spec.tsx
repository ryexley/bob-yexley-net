import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteSettingsView } from "@/modules/site-settings/views"
import type { AdminSiteSettingsQueryResult } from "@/modules/site-settings/data/types"

const { authState, navigate, adminSettingsResult, latestDrawerProps } =
  vi.hoisted(() => ({
    authState: {
      profile: {
        user: { id: "user-1", email: "bob@yexley.net" },
        role: "superuser",
      } as any,
    },
    navigate: vi.fn(),
    adminSettingsResult: {
      value: {
        authorized: true,
        settings: {
          homeHeroImageIds: [
            "green-forest-near-mountain-2z2CGEB7FIk",
            "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
          ],
        },
        error: null,
      } as AdminSiteSettingsQueryResult,
    },
    latestDrawerProps: {
      value: null as any,
    },
  }))

vi.mock("@solidjs/router", () => ({
  createAsync: () => () => adminSettingsResult.value,
  useNavigate: () => navigate,
  query: (fn: unknown) => fn,
  revalidate: vi.fn(),
}))

vi.mock("@solidjs/meta", () => ({
  Title: () => null,
  Meta: () => null,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    profile: () => authState.profile,
    user: () => authState.profile?.user ?? null,
    role: () => authState.profile?.role ?? null,
    loading: () => false,
    isAuthenticated: () => Boolean(authState.profile?.user),
    isAdmin: () =>
      authState.profile?.role === "admin" ||
      authState.profile?.role === "superuser",
    isSuperuser: () => authState.profile?.role === "superuser",
  }),
}))

vi.mock("@/components/icon", () => ({
  Icon: (props: any) => <span>{props.name}</span>,
  LoadingSpinner: () => <span>loading</span>,
}))

vi.mock("@/modules/site-settings/components/home-hero-images-drawer", () => ({
  HomeHeroImagesDrawer: (props: any) => {
    latestDrawerProps.value = props
    return (
      <div
        data-testid="home-hero-images-drawer"
        data-open={props.open ? "true" : "false"}
      />
    )
  },
}))

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "siteSettings.views.index.pageTitle": "Site Settings",
      "siteSettings.views.index.metaDescription": "Manage site-wide settings.",
      "siteSettings.views.index.title": "Site Settings",
      "siteSettings.views.index.subtitle": "Site-wide content",
      "siteSettings.views.index.loading": "Loading site settings...",
      "siteSettings.views.index.actions.backToAdmin": "admin",
      "siteSettings.views.index.cards.homeHeroImages.title": "Home page images",
      "siteSettings.views.index.cards.homeHeroImages.description":
        "Choose the Unsplash photos",
      "siteSettings.views.index.cards.homeHeroImages.total": "2 images",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

vi.mock("@/urls", () => ({
  pages: {
    admin: "/a",
    home: "/",
    login: "/a/li",
    siteSettings: "/a/settings",
  },
}))

vi.mock("@/util/browser", () => ({
  windowTitle: (value: string) => value,
}))

describe("SiteSettingsView", () => {
  beforeEach(() => {
    authState.profile = {
      user: { id: "user-1", email: "bob@yexley.net" },
      role: "superuser",
    }
    navigate.mockReset()
    adminSettingsResult.value = {
      authorized: true,
      settings: {
        homeHeroImageIds: [
          "green-forest-near-mountain-2z2CGEB7FIk",
          "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
        ],
      },
      error: null,
    }
    latestDrawerProps.value = null
  })

  it("shows the home page images card and opens its drawer", async () => {
    render(() => <SiteSettingsView />)

    expect(screen.getByRole("heading", { name: "Site Settings" })).toBeTruthy()
    const card = screen.getByRole("button", { name: /Home page images/ })
    expect(card).toBeTruthy()

    await fireEvent.click(card)

    await waitFor(() => {
      expect(
        screen.getByTestId("home-hero-images-drawer").getAttribute("data-open"),
      ).toBe("true")
    })
    expect(latestDrawerProps.value.imageIds).toEqual([
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ])
  })

  it("sends visitors back to the home page", () => {
    authState.profile = {
      user: { id: "user-2", email: "visitor@example.com" },
      role: "visitor",
    }

    render(() => <SiteSettingsView />)

    expect(navigate).toHaveBeenCalledWith("/", { replace: true })
  })
})
