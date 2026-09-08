import { fireEvent, render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { VisitorAuthModal } from "@/modules/auth/components/visitor-auth-modal"
import { pages } from "@/urls"

vi.mock("@/components/dialog", () => ({
  Dialog: (props: { children: unknown }) => <div>{props.children}</div>,
  DialogHeader: (props: { children: unknown }) => <header>{props.children}</header>,
  DialogTitle: (props: { children: unknown }) => <div>{props.children}</div>,
  DialogDescription: (props: { children: unknown }) => <p>{props.children}</p>,
  DialogBody: (props: { children: unknown }) => <section>{props.children}</section>,
  DialogFooter: (props: { children: unknown }) => <footer>{props.children}</footer>,
}))

describe("VisitorAuthModal staff entrance", () => {
  it("hides a staff login path behind the shield icon", () => {
    const onOpenChange = vi.fn()

    render(() => (
      <VisitorAuthModal
        open
        onOpenChange={onOpenChange}
      />
    ))

    const staffLink = document.querySelector(".visitor-auth-staff-link")
    expect(staffLink?.getAttribute("href")).toBe(pages.login)
    expect(staffLink?.getAttribute("aria-hidden")).toBe("true")
    expect(staffLink?.getAttribute("tabindex")).toBe("-1")

    fireEvent.click(staffLink as HTMLAnchorElement)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
