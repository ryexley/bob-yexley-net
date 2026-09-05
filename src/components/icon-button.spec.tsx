import { render, screen } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import { IconButton } from "@/components/icon-button"

describe("IconButton", () => {
  it("updates disabled without remounting", () => {
    const [disabled, setDisabled] = createSignal(true)

    render(() => (
      <IconButton
        icon="cloud_upload"
        aria-label="Save"
        disabled={disabled()}
      />
    ))

    const button = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement
    expect(button.disabled).toBe(true)

    setDisabled(false)

    expect(screen.getByRole("button", { name: "Save" })).toBe(button)
    expect(button.disabled).toBe(false)
  })
})
