import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { BlipCommentEditor } from "@/modules/blips/components/blip-comment-editor"

const { state } = vi.hoisted(() => ({
  state: {
    viewportWidth: 375,
    lastMarkdownEditorProps: null as any,
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
    userProfile: () => ({
      id: "user-1",
      displayName: "Test User",
      avatarSeed: null,
      avatarVersion: null,
    }),
    isSuperuser: () => false,
  }),
}))

vi.mock("@/context/viewport", () => ({
  useViewport: () => ({
    width: () => state.viewportWidth,
    height: () => 844,
  }),
}))

vi.mock("@/components/confirm-dialog", () => ({
  useConfirm: () => vi.fn(),
}))

vi.mock("@/components/notification", () => ({
  useNotify: () => ({
    error: vi.fn(),
  }),
}))

vi.mock("@/components/dialog", () => ({
  Dialog: (props: any) => (
    <div data-testid="mock-comment-dialog" data-open={String(props.open)}>
      {props.children}
    </div>
  ),
  DialogTitle: (props: any) => <div>{props.children}</div>,
}))

vi.mock("@/modules/blips/data", () => ({
  BLIP_TYPES: {
    COMMENT: "comment",
  },
  blipId: () => "comment-1",
  blipStore: () => ({
    getById: () => null,
    upsert: vi.fn(async () => ({ error: null, data: null })),
    remove: vi.fn(async () => ({ error: null })),
  }),
}))

vi.mock("@/components/markdown/editor", async importOriginal => {
  const actual = await importOriginal<typeof import("@/components/markdown/editor")>()

  return {
    ...actual,
    MarkdownEditor: (props: any) => {
      state.lastMarkdownEditorProps = props

      return (
        <div data-testid="mock-comment-markdown-editor">
          <button
            type="button"
            data-testid="mock-comment-change"
            onClick={() => props.onChange?.("New comment body")}
          />
          {props.EditorControls?.({
            onToggleToolbar: () => undefined,
            toolbarVisible: false,
            statusIcon: props.statusIcon,
            showStatus: props.showStatus,
            statusFading: props.statusFading,
            statusContext: props.statusContext,
          })}
        </div>
      )
    },
  }
})

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "blips.components.commentEditor.placeholder": "Write a comment",
      "blips.components.commentEditor.modeLabel": "Comment",
      "blips.components.commentEditor.titles.new": "New comment",
      "blips.components.commentEditor.titles.edit": "Edit comment",
      "blips.components.commentEditor.actions.close": "Close",
      "blips.components.commentEditor.actions.delete": "Delete",
      "blips.components.commentEditor.actions.save": "Save",
      "blips.components.commentEditor.actions.saving": "Saving",
      "blips.components.commentEditor.actions.toggleToolbar": "Toggle toolbar",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

describe("BlipCommentEditor integration", () => {
  it("enables save after markdown content changes", async () => {
    state.lastMarkdownEditorProps = null

    render(() => (
      <BlipCommentEditor
        open
        parentBlipId="root-1"
        onRequestClose={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-comment-markdown-editor")).toBeTruthy()
    })

    const saveButton = document.querySelector(
      ".blip-action-save",
    ) as HTMLButtonElement | null
    expect(saveButton).toBeTruthy()
    expect(saveButton?.disabled).toBe(true)

    await fireEvent.click(screen.getByTestId("mock-comment-change"))

    await waitFor(() => {
      expect(state.lastMarkdownEditorProps.statusContext.canSave).toBe(true)
      expect(
        (document.querySelector(".blip-action-save") as HTMLButtonElement | null)
          ?.disabled,
      ).toBe(false)
    })
  })
})
