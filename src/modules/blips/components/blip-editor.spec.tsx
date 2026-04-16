import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"
import {
  BlipEditor,
  getDesktopSizePreset,
} from "@/modules/blips/components/blip-editor"

const { state, toggleToolbar } = vi.hoisted(() => ({
  state: {
    drafts: [] as Blip[],
    entities: [] as Blip[],
    lastMarkdownEditorProps: null as any,
  },
  toggleToolbar: vi.fn(),
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
    width: () => 1440,
    height: () => 900,
  }),
}))

vi.mock("@/components/confirm-dialog", () => ({
  useConfirm: () => vi.fn(),
}))

vi.mock("@/modules/blips/data", () => ({
  blipId: () => "draft-1",
  blipStore: () => ({
    drafts: () => state.drafts,
    entities: () => state.entities,
    getById: (id: string) => state.entities.find(blip => blip.id === id) ?? null,
    upsert: vi.fn(async () => ({ error: null })),
    publish: vi.fn(async () => ({ error: null })),
    unpublish: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
  }),
  tagStore: () => ({
    listTags: vi.fn(async () => ({ error: null, data: [] })),
    getBlipTagValues: vi.fn(async () => ({ error: null, data: [] })),
    replaceBlipTags: vi.fn(async () => ({ error: null, data: [] })),
  }),
}))

vi.mock("@/modules/blips/components/blip-tags", () => ({
  BlipTags: () => <div data-testid="mock-blip-tags">tags</div>,
}))

vi.mock("@/components/markdown/editor", async importOriginal => {
  const actual = await importOriginal<typeof import("@/components/markdown/editor")>()

  return {
    ...actual,
    MarkdownEditor: (props: any) => (
      <div
        data-testid="mock-markdown-editor"
        data-focus-nonce={String(props.focusNonce ?? 0)}>
        {(state.lastMarkdownEditorProps = props) && null}
        <div>editor</div>
        {props.BelowEditor?.({
          onToggleToolbar: toggleToolbar,
          toolbarVisible: false,
          statusIcon: props.statusIcon,
          showStatus: props.showStatus,
          statusFading: props.statusFading,
          statusContext: props.statusContext,
        })}
      </div>
    ),
  }
})

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "blips.components.blipEditor.placeholder": "What's on your mind?",
      "blips.components.blipEditor.tags.ariaLabel": "Blip tags",
      "blips.components.blipEditor.tags.placeholder": "tags...",
      "blips.components.blipEditor.draftPicker.new": "New Blip",
      "blips.components.blipEditor.draftPicker.untitled": "Untitled draft",
      "blips.components.blipEditor.actions.close": "Close",
      "blips.components.blipEditor.actions.save": "Save",
      "blips.components.blipEditor.actions.publish": "Publish",
      "blips.components.blipEditor.actions.unpublish": "Unpublish",
      "blips.components.blipEditor.actions.delete": "Delete Draft",
      "blips.components.blipEditor.actions.toggleToolbar":
        "Toggle formatting toolbar",
      "blips.components.blipEditor.confirmDelete.title": "Delete draft blip?",
      "blips.components.blipEditor.confirmDelete.prompt": "Delete it?",
      "blips.components.blipEditor.confirmDelete.actions.confirm": "Delete",
      "blips.components.blipEditor.confirmDelete.actions.confirming":
        "Deleting...",
      "blips.components.blipEditor.confirmDelete.actions.cancel": "Keep draft",
    }

    return (key: string) => values[`${prefix}.${key}`] ?? `${prefix}.${key}`
  },
}))

const makeDraft = (overrides: Partial<Blip> = {}): Blip => ({
  id: "draft-1",
  title: null,
  content: "Draft body",
  user_id: "user-1",
  parent_id: null,
  blip_type: BLIP_TYPES.ROOT,
  updates_count: 0,
  published: false,
  moderation_status: "approved",
  tags: [],
  reactions_count: 0,
  my_reaction_count: 0,
  reactions: [],
  created_at: "2026-03-30T12:00:00.000Z",
  updated_at: "2026-03-30T12:00:00.000Z",
  ...overrides,
})

describe("BlipEditor", () => {
  beforeEach(() => {
    state.drafts = []
    state.entities = []
    toggleToolbar.mockReset()
    state.lastMarkdownEditorProps = null
    window.scrollTo = vi.fn()
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("renders the bottom control pill in editor mode and wires the relocated toolbar toggle", async () => {
    const onPanelOpenChange = vi.fn()
    render(() => (
      <BlipEditor
        open
        onPanelOpenChange={onPanelOpenChange}
        close={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-markdown-editor")).toBeTruthy()
    })

    expect(screen.getByTestId("mock-blip-tags")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy()

    const toggleButton = document.querySelector(
      ".blip-editor-toolbar-toggle",
    ) as HTMLButtonElement | null
    expect(toggleButton).toBeTruthy()
    await fireEvent.click(toggleButton!)
    expect(toggleToolbar).toHaveBeenCalledTimes(1)

    const closeButton = document.querySelector(
      ".blip-editor-control-pill .blip-editor-close",
    ) as HTMLButtonElement | null
    expect(closeButton).toBeTruthy()

    await fireEvent.click(closeButton!)
    expect(onPanelOpenChange).toHaveBeenCalledWith(false)
  })

  it("requests editor focus when switching from the draft picker into editor mode", async () => {
    state.drafts = [makeDraft()]
    render(() => (
      <BlipEditor
        open
        onPanelOpenChange={() => undefined}
        close={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Blip" })).toBeTruthy()
    })

    await fireEvent.click(screen.getByRole("button", { name: "New Blip" }))

    await waitFor(() => {
      expect(screen.getByTestId("mock-markdown-editor")).toBeTruthy()
    })

    expect(
      Number(screen.getByTestId("mock-markdown-editor").getAttribute("data-focus-nonce")),
    ).toBeGreaterThan(0)
  })

  it("keeps the draft picker closable when drafts are available", async () => {
    state.drafts = [makeDraft()]
    const onPanelOpenChange = vi.fn()
    render(() => (
      <BlipEditor
        open
        onPanelOpenChange={onPanelOpenChange}
        close={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Blip" })).toBeTruthy()
    })

    const closeButton = document.querySelector(
      ".blip-editor-picker-close",
    ) as HTMLButtonElement | null
    expect(closeButton).toBeTruthy()

    await fireEvent.click(closeButton!)
    expect(onPanelOpenChange).toHaveBeenCalledWith(false)
  })

  it("applies the compact desktop shell size by default and expands when content metrics cross thresholds", async () => {
    render(() => (
      <BlipEditor
        open
        onPanelOpenChange={() => undefined}
        close={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-markdown-editor")).toBeTruthy()
    })

    const dialog = document.querySelector(".blip-editor-dialog") as HTMLElement | null
    expect(dialog).toBeTruthy()
    expect(dialog?.style.getPropertyValue("--blip-editor-shell-width")).toBe("400px")
    expect(dialog?.style.getPropertyValue("--blip-editor-shell-max-height")).toBe(
      "416px",
    )

    state.lastMarkdownEditorProps.onContentMetricsChange({
      characterCount: 1300,
      wordCount: 240,
      paragraphCount: 6,
    })

    await waitFor(() => {
      expect(dialog?.style.getPropertyValue("--blip-editor-shell-width")).toBe(
        "672px",
      )
      expect(dialog?.style.getPropertyValue("--blip-editor-shell-max-height")).toBe(
        "608px",
      )
    })

    state.lastMarkdownEditorProps.onContentMetricsChange({
      characterCount: 2400,
      wordCount: 420,
      paragraphCount: 12,
    })

    await waitFor(() => {
      expect(dialog?.style.getPropertyValue("--blip-editor-shell-width")).toBe(
        "768px",
      )
      expect(dialog?.style.getPropertyValue("--blip-editor-shell-max-height")).toBe(
        "704px",
      )
    })
  })

  it("sizes the desktop shell immediately for an existing long-form blip", async () => {
    state.entities = [
      makeDraft({
        id: "blip-42",
        content: Array.from({ length: 450 }, () => "word").join(" "),
      }),
    ]

    render(() => (
      <BlipEditor
        open
        blipId="blip-42"
        onPanelOpenChange={() => undefined}
        close={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-markdown-editor")).toBeTruthy()
    })

    const dialog = document.querySelector(".blip-editor-dialog") as HTMLElement | null
    expect(dialog).toBeTruthy()

    await waitFor(() => {
      expect(dialog?.style.getPropertyValue("--blip-editor-shell-width")).toBe(
        "768px",
      )
      expect(dialog?.style.getPropertyValue("--blip-editor-shell-max-height")).toBe(
        "704px",
      )
    })
  })
})

describe("getDesktopSizePreset", () => {
  it("stays compact below the first threshold", () => {
    expect(
      getDesktopSizePreset({
        characterCount: 419,
        wordCount: 74,
        paragraphCount: 2,
      }),
    ).toEqual({
      minCharacters: 0,
      minWords: 0,
      widthPx: 400,
      maxHeightPx: 416,
    })
  })

  it("promotes to the highest matching preset from either character or word thresholds", () => {
    expect(
      getDesktopSizePreset({
        characterCount: 500,
        wordCount: 390,
        paragraphCount: 4,
      }),
    ).toEqual({
      minCharacters: 2200,
      minWords: 380,
      widthPx: 768,
      maxHeightPx: 704,
    })

    expect(
      getDesktopSizePreset({
        characterCount: 1300,
        wordCount: 100,
        paragraphCount: 5,
      }),
    ).toEqual({
      minCharacters: 1200,
      minWords: 220,
      widthPx: 672,
      maxHeightPx: 608,
    })
  })
})
