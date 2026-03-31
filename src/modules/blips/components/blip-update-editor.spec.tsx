import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BlipUpdateEditor } from "@/modules/blips/components/blip-update-editor"

const { state, confirmMock, dialogState } = vi.hoisted(() => ({
  state: {
    entities: [] as any[],
    viewportWidth: 375,
  },
  confirmMock: vi.fn(),
  dialogState: {
    lastProps: null as any,
  },
}))

vi.mock("@/context/services-context", () => ({
  useSupabase: () => ({
    client: {},
  }),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: () => ({ id: "user-1" }),
  }),
}))

vi.mock("@/context/viewport", () => ({
  useViewport: () => ({
    width: () => state.viewportWidth,
    height: () => 844,
  }),
}))

vi.mock("@/components/confirm-dialog", () => ({
  useConfirm: () => confirmMock,
}))

vi.mock("@/components/dialog", () => ({
  Dialog: (props: any) => {
    dialogState.lastProps = props
    return (
      <div
        data-testid="mock-update-dialog"
        data-open={String(props.open)}>
        {props.children}
        <button
          type="button"
          data-testid="mock-dialog-dismiss"
          onClick={() => props.onOpenChange?.(false)}>
          dismiss
        </button>
      </div>
    )
  },
  DialogTitle: (props: any) => (
    <div
      data-testid="mock-dialog-title"
      class={props.class}>
      {props.children}
    </div>
  ),
}))

vi.mock("@/modules/blips/data", () => ({
  BLIP_TYPES: {
    ROOT: "root",
    UPDATE: "update",
  },
  blipId: () => "update-1",
  blipStore: () => ({
    entities: () => state.entities,
    getById: (id: string) => state.entities.find(blip => blip.id === id) ?? null,
    upsert: vi.fn(async () => ({
      error: null,
      data: { id: "update-1", published: true, tags: [] },
    })),
    remove: vi.fn(async () => ({ error: null })),
  }),
}))

vi.mock("@/components/markdown/editor", () => ({
  MarkdownEditor: (props: any) => (
    <div
      data-testid="mock-update-markdown-editor"
      data-focus-nonce={String(props.focusNonce ?? 0)}>
      <button
        type="button"
        data-testid="mock-update-change"
        onClick={() => props.onChange?.("Draft update")}
      />
    </div>
  ),
}))

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "blips.views.detail.updates.editor.editingLabel": "Editing update",
      "blips.views.detail.updates.editor.newLabel": "New update",
      "blips.views.detail.updates.placeholder": "Share an update",
      "blips.views.detail.updates.actions.close": "Close",
      "blips.views.detail.updates.actions.delete": "Delete",
      "blips.views.detail.updates.confirmDelete.title": "Delete update?",
      "blips.views.detail.updates.confirmDelete.persistedPrompt": "Delete persisted update?",
      "blips.views.detail.updates.confirmDelete.unsavedPrompt": "Delete unsaved update?",
      "blips.views.detail.updates.confirmDelete.actions.confirm": "Delete",
      "blips.views.detail.updates.confirmDelete.actions.confirming": "Deleting...",
      "blips.views.detail.updates.confirmDelete.actions.cancel": "Cancel",
      "blips.views.detail.updates.confirmCloseDraft.title": "Discard draft?",
      "blips.views.detail.updates.confirmCloseDraft.prompt": "Close without saving?",
      "blips.views.detail.updates.confirmCloseDraft.actions.close": "Close",
      "blips.views.detail.updates.confirmCloseDraft.actions.closing": "Closing...",
      "blips.views.detail.updates.confirmCloseDraft.actions.cancel": "Keep editing",
      "blips.components.blipEditor.actions.close": "Close",
      "blips.components.blipEditor.actions.delete": "Delete",
      "blips.components.blipEditor.actions.publish": "Publish",
      "blips.components.blipEditor.actions.unpublish": "Unpublish",
      "blips.components.blipEditor.actions.save": "Save",
      "blips.components.blipEditor.status.saving": "Saving",
      "blips.components.blipEditor.status.saved": "Saved",
      "blips.components.blipEditor.status.error": "Error",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

describe("BlipUpdateEditor", () => {
  beforeEach(() => {
    state.entities = []
    state.viewportWidth = 375
    confirmMock.mockReset()
    dialogState.lastProps = null
  })

  it("uses the shared dialog wrapper on mobile", async () => {
    render(() => (
      <BlipUpdateEditor
        open
        rootBlipId="root-1"
        onRequestClose={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-update-dialog")).toBeTruthy()
    })
    expect(screen.getByTestId("mock-dialog-title").textContent).toBe("New update")
    expect(dialogState.lastProps.forceMount).toBeUndefined()
  })

  it("keeps the inline shell on desktop", async () => {
    state.viewportWidth = 1024
    const view = render(() => (
      (() => {
        const [desktopMount, setDesktopMount] = createSignal<HTMLDivElement | null>(
          null,
        )

        return (
          <>
            <div
              data-testid="mock-update-desktop-mount"
              ref={element => setDesktopMount(element)}
            />
            <BlipUpdateEditor
              open
              rootBlipId="root-1"
              desktopMount={desktopMount()}
              onRequestClose={() => undefined}
            />
          </>
        )
      })()
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-update-markdown-editor")).toBeTruthy()
    })
    expect(screen.queryByTestId("mock-update-dialog")).toBeNull()
    expect(
      screen
        .getByTestId("mock-update-desktop-mount")
        .querySelector(".blip-update-editor-layer"),
    ).toBeTruthy()
  })

  it("bumps the markdown editor focus nonce when opened and when external focus changes", async () => {
    const [focusNonce, setFocusNonce] = createSignal(1)

    render(() => (
      <BlipUpdateEditor
        open
        rootBlipId="root-1"
        focusNonce={focusNonce()}
        onRequestClose={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(
        Number(
          screen.getByTestId("mock-update-markdown-editor").getAttribute(
            "data-focus-nonce",
          ),
        ),
      ).toBeGreaterThan(1)
    })

    setFocusNonce(2)

    await waitFor(() => {
      expect(
        Number(
          screen.getByTestId("mock-update-markdown-editor").getAttribute(
            "data-focus-nonce",
          ),
        ),
      ).toBeGreaterThan(2)
    })
  })

  it("routes dialog dismissal and parent close requests through the shared close path", async () => {
    const onRequestClose = vi.fn()
    const [closeRequestNonce, setCloseRequestNonce] = createSignal(0)

    render(() => (
      <BlipUpdateEditor
        open
        rootBlipId="root-1"
        closeRequestNonce={closeRequestNonce()}
        onRequestClose={onRequestClose}
      />
    ))

    await fireEvent.click(screen.getByTestId("mock-dialog-dismiss"))
    expect(onRequestClose).toHaveBeenCalled()
    onRequestClose.mockClear()

    await fireEvent.click(screen.getByTestId("mock-update-change"))
    setCloseRequestNonce(1)

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledTimes(1)
    })
  })
})
