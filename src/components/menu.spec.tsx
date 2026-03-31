import { render, screen } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { Menu } from "@/components/menu"

vi.mock("@kobalte/core/dropdown-menu", () => ({
  DropdownMenu: Object.assign(
    (props: any) => <div data-testid="dropdown-root">{props.children}</div>,
    {
      Trigger: (props: any) => (
        <button type="button" class={props.class}>
          {props.children}
        </button>
      ),
      Portal: (props: any) => <>{props.children}</>,
      Content: (props: any) => <div class={props.class}>{props.children}</div>,
      Arrow: (props: any) => <div class={props.class} />,
      Separator: (props: any) => <hr class={props.class} />,
      Item: (props: any) => (
        <button type="button" class={props.class} onClick={props.onSelect}>
          {props.children}
        </button>
      ),
    },
  ),
}))

vi.mock("@/components/icon", () => ({
  Icon: (props: { name: string }) => <span>{props.name}</span>,
}))

describe("Menu", () => {
  it("renders custom jsx trigger and header content", () => {
    render(() => (
      <Menu
        Trigger={<span>custom trigger</span>}
        Header={<div>custom header</div>}
        items={[{ label: "Profile", onClick: () => {} }]}
      />
    ))

    expect(screen.getByRole("button", { name: "custom trigger" })).toBeTruthy()
    expect(screen.getByText("custom header")).toBeTruthy()
    expect(screen.queryByText("more_vert")).toBeNull()
  })

  it("renders default trigger icon when custom trigger is absent", () => {
    render(() => <Menu items={[{ label: "Profile", onClick: () => {} }]} />)

    expect(screen.getByText("more_vert")).toBeTruthy()
  })
})
