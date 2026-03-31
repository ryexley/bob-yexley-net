import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { BlipComposerProvider, useBlipComposer } from "@/modules/blips/context/blip-composer-context"

const rootEditorState = vi.hoisted(() => ({
  renderCount: 0,
  lastProps: null as any,
}))

const updateEditorState = vi.hoisted(() => ({
  renderCount: 0,
  lastProps: null as any,
}))

vi.mock("@/modules/blips/components/blip-editor", () => ({
  BlipEditor: (props: any) => {
    rootEditorState.renderCount += 1
    rootEditorState.lastProps = props

    return props.open ? <div data-testid="shared-root-editor" /> : null
  },
}))

vi.mock("@/modules/blips/components/blip-update-editor", () => ({
  BlipUpdateEditor: (props: any) => {
    updateEditorState.renderCount += 1
    updateEditorState.lastProps = props

    return props.open ? <div data-testid="shared-update-editor" /> : null
  },
}))

function Harness() {
  const composer = useBlipComposer()

  return (
    <div>
      <div
        data-testid="shared-update-inline-mount"
        ref={element => composer.registerUpdateInlineMount("root-1", element)}
      />
      <button type="button" onClick={() => composer.openNewRoot()}>
        open new root
      </button>
      <button type="button" onClick={() => composer.openEditRoot("blip-1")}>
        open edit root
      </button>
      <button type="button" onClick={() => composer.openNewUpdate("root-1")}>
        open new update
      </button>
      <button
        type="button"
        onClick={() => composer.openEditUpdate("root-1", "update-1")}>
        open edit update
      </button>
      <button type="button" onClick={() => composer.requestCloseActive()}>
        request close active
      </button>
      <button type="button" onClick={() => composer.closeActive()}>
        close active
      </button>
      <output data-testid="update-open-for-root-1">
        {String(composer.isUpdateOpenFor("root-1"))}
      </output>
    </div>
  )
}

describe("BlipComposerProvider", () => {
  it("lazily mounts and reuses the shared root editor host", async () => {
    rootEditorState.renderCount = 0
    rootEditorState.lastProps = null
    updateEditorState.renderCount = 0
    updateEditorState.lastProps = null

    render(() => (
      <BlipComposerProvider>
        <Harness />
      </BlipComposerProvider>
    ))

    expect(screen.queryByTestId("shared-root-editor")).toBeNull()
    expect(rootEditorState.renderCount).toBe(0)
    expect(updateEditorState.renderCount).toBe(0)

    await fireEvent.click(screen.getByRole("button", { name: "open new root" }))

    await waitFor(() => {
      expect(rootEditorState.lastProps?.open).toBe(true)
    })
    expect(rootEditorState.renderCount).toBe(1)
    expect(rootEditorState.lastProps.blipId).toBeNull()

    await fireEvent.click(screen.getByRole("button", { name: "close active" }))

    await waitFor(() => {
      expect(rootEditorState.lastProps?.open).toBe(false)
    })

    await fireEvent.click(screen.getByRole("button", { name: "open edit root" }))

    await waitFor(() => {
      expect(rootEditorState.lastProps?.open).toBe(true)
    })
    expect(rootEditorState.renderCount).toBe(1)
    expect(rootEditorState.lastProps.blipId).toBe("blip-1")
  })

  it("lazily mounts and reuses the shared update editor host", async () => {
    rootEditorState.renderCount = 0
    rootEditorState.lastProps = null
    updateEditorState.renderCount = 0
    updateEditorState.lastProps = null

    render(() => (
      <BlipComposerProvider>
        <Harness />
      </BlipComposerProvider>
    ))

    expect(screen.queryByTestId("shared-update-editor")).toBeNull()
    expect(updateEditorState.renderCount).toBe(0)
    expect(screen.getByTestId("update-open-for-root-1").textContent).toBe("false")

    await fireEvent.click(screen.getByRole("button", { name: "open new update" }))

    await waitFor(() => {
      expect(updateEditorState.lastProps?.open).toBe(true)
    })
    expect(updateEditorState.renderCount).toBe(1)
    expect(updateEditorState.lastProps.rootBlipId).toBe("root-1")
    expect(updateEditorState.lastProps.editingUpdateId).toBeNull()
    expect(updateEditorState.lastProps.focusNonce).toBe(1)
    expect(screen.getByTestId("update-open-for-root-1").textContent).toBe("true")

    await fireEvent.click(screen.getByRole("button", { name: "request close active" }))

    await waitFor(() => {
      expect(updateEditorState.lastProps?.closeRequestNonce).toBe(1)
    })
    expect(updateEditorState.lastProps.open).toBe(true)

    updateEditorState.lastProps.onRequestClose?.()

    await waitFor(() => {
      expect(updateEditorState.lastProps?.open).toBe(false)
    })
    expect(screen.getByTestId("update-open-for-root-1").textContent).toBe("false")

    await fireEvent.click(screen.getByRole("button", { name: "open edit update" }))

    await waitFor(() => {
      expect(updateEditorState.lastProps?.open).toBe(true)
    })
    expect(updateEditorState.renderCount).toBe(1)
    expect(updateEditorState.lastProps.rootBlipId).toBe("root-1")
    expect(updateEditorState.lastProps.editingUpdateId).toBe("update-1")
    expect(updateEditorState.lastProps.focusNonce).toBe(2)
  })

  it("keeps the desktop update mount stable while closing", async () => {
    updateEditorState.renderCount = 0
    updateEditorState.lastProps = null

    render(() => (
      <BlipComposerProvider>
        <Harness />
      </BlipComposerProvider>
    ))

    const inlineMount = screen.getByTestId("shared-update-inline-mount")

    await fireEvent.click(screen.getByRole("button", { name: "open new update" }))

    await waitFor(() => {
      expect(updateEditorState.lastProps?.open).toBe(true)
    })
    expect(updateEditorState.lastProps.rootBlipId).toBe("root-1")
    expect(updateEditorState.lastProps.desktopMount).toBe(inlineMount)

    await fireEvent.click(screen.getByRole("button", { name: "close active" }))

    await waitFor(() => {
      expect(updateEditorState.lastProps?.open).toBe(false)
    })
    expect(updateEditorState.lastProps.rootBlipId).toBe("root-1")
    expect(updateEditorState.lastProps.desktopMount).toBe(inlineMount)
  })
})
