import { fireEvent, render, screen } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { HomeHeroImagesDrawer } from "@/modules/site-settings/components/home-hero-images-drawer"

const { updateHomeHeroImageIdsRecord, notifySuccess, notifyError } = vi.hoisted(
  () => ({
    updateHomeHeroImageIdsRecord: vi.fn(),
    notifySuccess: vi.fn(),
    notifyError: vi.fn(),
  }),
)

vi.mock("@/components/form-drawer", () => ({
  FormDrawer: (props: any) =>
    props.open ? (
      <section>
        <h2>{props.title}</h2>
        {props.children}
        <div>{props.actions}</div>
      </section>
    ) : null,
}))

vi.mock("@/components/button", () => ({
  Button: (props: any) => (
    <button
      type={props.type ?? "button"}
      form={props.form}
      disabled={props.disabled}
      onClick={props.onClick}>
      {props.label}
    </button>
  ),
}))

vi.mock("@/components/icon-button", () => ({
  IconButton: (props: any) => (
    <button
      type="button"
      aria-label={props["aria-label"]}
      disabled={props.disabled}
      onClick={props.onClick}>
      {props.icon}
    </button>
  ),
}))

vi.mock("@/components/image", () => ({
  UnsplashImage: (props: any) => (
    <img
      alt={props.alt}
      data-image-id={props.imageId}
    />
  ),
}))

vi.mock("@/components/input", () => ({
  Input: (props: any) => (
    <label>
      <span>{props.label}</span>
      <input
        value={props.value ?? ""}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onInput={props.onInput}
      />
    </label>
  ),
}))

vi.mock("@/components/notification", () => ({
  useNotify: () => ({
    success: notifySuccess,
    error: notifyError,
  }),
}))

vi.mock("@/modules/site-settings/data/client", () => ({
  updateHomeHeroImageIdsRecord,
}))

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "siteSettings.components.homeHeroImagesDrawer.title": "Home page images",
      "siteSettings.components.homeHeroImagesDrawer.hint":
        "These Unsplash photos rotate",
      "siteSettings.components.homeHeroImagesDrawer.actions.close": "Close",
      "siteSettings.components.homeHeroImagesDrawer.actions.cancel": "Cancel",
      "siteSettings.components.homeHeroImagesDrawer.actions.save": "Save",
      "siteSettings.components.homeHeroImagesDrawer.actions.saving":
        "Saving...",
      "siteSettings.components.homeHeroImagesDrawer.actions.add": "Add image",
      "siteSettings.components.homeHeroImagesDrawer.actions.moveUp":
        "Move image up",
      "siteSettings.components.homeHeroImagesDrawer.actions.moveDown":
        "Move image down",
      "siteSettings.components.homeHeroImagesDrawer.actions.remove":
        "Remove image",
      "siteSettings.components.homeHeroImagesDrawer.fields.add.label":
        "Add an Unsplash photo",
      "siteSettings.components.homeHeroImagesDrawer.fields.add.placeholder":
        "photo-slug",
      "siteSettings.components.homeHeroImagesDrawer.fields.add.hint":
        "Paste a URL",
      "siteSettings.components.homeHeroImagesDrawer.errors.invalid": "invalid",
      "siteSettings.components.homeHeroImagesDrawer.errors.duplicate":
        "duplicate",
      "siteSettings.components.homeHeroImagesDrawer.errors.max": "max",
      "siteSettings.components.homeHeroImagesDrawer.notifications.saveSuccess":
        "saved",
      "siteSettings.components.homeHeroImagesDrawer.notifications.saveError":
        "save error",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

describe("HomeHeroImagesDrawer", () => {
  it("adds a pasted Unsplash URL to the list and saves the result", async () => {
    updateHomeHeroImageIdsRecord.mockResolvedValue({
      success: true,
      data: [
        "green-forest-near-mountain-2z2CGEB7FIk",
        "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
      ],
      error: null,
    })
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()

    render(() => (
      <HomeHeroImagesDrawer
        open={true}
        imageIds={["green-forest-near-mountain-2z2CGEB7FIk"]}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />
    ))

    const input = screen.getByPlaceholderText("photo-slug")
    await fireEvent.input(input, {
      target: {
        value:
          "https://unsplash.com/photos/a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
      },
    })
    await fireEvent.click(screen.getByRole("button", { name: "Add image" }))

    expect(
      screen.getByText(
        "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
      ),
    ).toBeTruthy()

    await fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(updateHomeHeroImageIdsRecord).toHaveBeenCalledWith([
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ])
    expect(onSaved).toHaveBeenCalledWith([
      "green-forest-near-mountain-2z2CGEB7FIk",
      "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
    ])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
