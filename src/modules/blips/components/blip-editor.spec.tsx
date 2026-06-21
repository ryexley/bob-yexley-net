import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BLIP_TYPES, type Blip } from "@/modules/blips/data/schema"
import {
  BlipEditor,
  getDesktopSizePreset,
} from "@/modules/blips/components/blip-editor"

const { state, toggleToolbar, focusBridgeSpies, storeSpies } = vi.hoisted(() => ({
  state: {
    drafts: [] as Blip[],
    entities: [] as Blip[],
    lastMarkdownEditorProps: null as any,
    viewportWidth: 1440,
  },
  toggleToolbar: vi.fn(),
  focusBridgeSpies: {
    scheduleFocusAfterOpen: vi.fn(),
    clearTextInputSession: vi.fn(),
  },
  storeSpies: {
    upsert: vi.fn(
      async (_?: unknown, __?: { cacheOnly?: boolean }) => ({ error: null }),
    ),
    publish: vi.fn(async () => ({ error: null })),
    unpublish: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
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
    upsert: storeSpies.upsert,
    publish: storeSpies.publish,
    unpublish: storeSpies.unpublish,
    remove: storeSpies.remove,
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

vi.mock("@/components/switch", () => ({
  Switch: (props: any) => (
    <div data-testid="mock-switch">
      {props.label}
    </div>
  ),
}))

vi.mock("@/components/date-time-picker", () => ({
  DateTimePicker: (props: any) => (
    <div data-testid="mock-date-time-picker">
      {props.label}
    </div>
  ),
}))

vi.mock("@/modules/blips/components/editor-focus-bridge", () => ({
  createEditorFocusBridge: () => ({
    setFocusProxyRef: vi.fn(),
    cancelTextInputSessionCleanup: vi.fn(),
    clearScheduledFocus: vi.fn(),
    clearTextInputSession: focusBridgeSpies.clearTextInputSession,
    scheduleFocusAfterOpen: focusBridgeSpies.scheduleFocusAfterOpen,
  }),
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
        {props.metadataPanelVisible
          ? props.MetadataPanel?.({
              onToggleToolbar: toggleToolbar,
              toolbarVisible: false,
              statusIcon: props.statusIcon,
              showStatus: props.showStatus,
              statusFading: props.statusFading,
              statusContext: props.statusContext,
            })
          : null}
        {props.EditorControls?.({
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
      "blips.components.blipEditor.metadata.title": "Blip metadata",
      "blips.components.blipEditor.metadata.allowComments": "Allow Comments",
      "blips.components.blipEditor.metadata.publishAt": "Publish Date",
      "blips.components.blipEditor.draftPicker.new": "New Blip",
      "blips.components.blipEditor.draftPicker.untitled": "Untitled draft",
      "blips.components.blipEditor.actions.close": "Close",
      "blips.components.blipEditor.actions.save": "Save",
      "blips.components.blipEditor.actions.publish": "Publish",
      "blips.components.blipEditor.actions.unpublish": "Unpublish",
      "blips.components.blipEditor.actions.delete": "Delete Draft",
      "blips.components.blipEditor.actions.toggleToolbar":
        "Toggle formatting toolbar",
      "blips.components.blipEditor.actions.showMetadata": "Show blip metadata",
      "blips.components.blipEditor.actions.showEditor": "Return to editor",
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
    state.viewportWidth = 1440
    focusBridgeSpies.scheduleFocusAfterOpen.mockReset()
    focusBridgeSpies.clearTextInputSession.mockReset()
    storeSpies.upsert.mockReset()
    storeSpies.upsert.mockResolvedValue({ error: null })
    storeSpies.publish.mockReset()
    storeSpies.publish.mockResolvedValue({ error: null })
    storeSpies.unpublish.mockReset()
    storeSpies.unpublish.mockResolvedValue({ error: null })
    storeSpies.remove.mockReset()
    storeSpies.remove.mockResolvedValue({ error: null })
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

  it("renders the bottom control pill in editor mode and toggles the metadata panel", async () => {
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

    expect(screen.queryByTestId("mock-blip-tags")).toBeNull()
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Show blip metadata" })).toBeTruthy()

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

    await fireEvent.click(screen.getByRole("button", { name: "Show blip metadata" }))
    expect(screen.getByTestId("mock-blip-tags")).toBeTruthy()
    expect(screen.getByTestId("mock-switch")).toBeTruthy()
    expect(screen.getByTestId("mock-date-time-picker")).toBeTruthy()

    await fireEvent.click(closeButton!)
    expect(onPanelOpenChange).toHaveBeenCalledWith(false)
  })

  it("mounts the media attachment button in the control pill", async () => {
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

    await waitFor(() => {
      expect(
        document.querySelector(
          ".blip-editor-control-pill .blip-editor-media-button",
        ),
      ).toBeTruthy()
    })
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

    expect(focusBridgeSpies.scheduleFocusAfterOpen).toHaveBeenCalled()
  })

  it("clears editor focus when opening metadata and restores it when returning", async () => {
    state.viewportWidth = 390
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

    const toggle = screen.getByRole("button", { name: "Show blip metadata" })
    const mouseDown = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    })
    toggle.dispatchEvent(mouseDown)

    expect(mouseDown.defaultPrevented).toBe(false)
    expect(focusBridgeSpies.clearTextInputSession).toHaveBeenCalledWith(
      "blipEditor.metadataToggleMouseDown",
    )

    await fireEvent.click(toggle)

    expect(focusBridgeSpies.clearTextInputSession).toHaveBeenCalledWith(
      "blipEditor.metadataOpen",
    )

    await fireEvent.click(screen.getByRole("button", { name: "Return to editor" }))

    expect(focusBridgeSpies.scheduleFocusAfterOpen).toHaveBeenCalled()
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

  it("waits for root draft cloud sync before closing", async () => {
    let resolveDbUpsert!: (value: { error: null }) => void
    storeSpies.upsert.mockImplementation((_: unknown, options?: { cacheOnly?: boolean }) => {
      if (options?.cacheOnly) {
        return Promise.resolve({ error: null })
      }

      return new Promise(resolve => {
        resolveDbUpsert = resolve as (value: { error: null }) => void
      })
    })

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

    state.lastMarkdownEditorProps.onChange("Updated draft body")
    await fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(onPanelOpenChange).not.toHaveBeenCalled()

    resolveDbUpsert({ error: null })

    await waitFor(() => {
      expect(onPanelOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("keeps the root editor open when close-time cloud sync fails", async () => {
    storeSpies.upsert.mockImplementation((_: unknown, options?: { cacheOnly?: boolean }) => {
      if (options?.cacheOnly) {
        return Promise.resolve({ error: null })
      }

      return Promise.resolve({ error: "sync failed" })
    })

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

    state.lastMarkdownEditorProps.onChange("Updated draft body")
    await fireEvent.click(screen.getByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(storeSpies.upsert).toHaveBeenCalled()
    })

    expect(onPanelOpenChange).not.toHaveBeenCalled()
    expect(screen.getByTestId("mock-markdown-editor")).toBeTruthy()
  })

  it("re-shows the draft picker when a new-root open request happens before close cleanup finishes", async () => {
    state.drafts = [makeDraft()]
    let setOpen!: (value: boolean) => void

    render(() => {
      const [open, updateOpen] = createSignal(true)
      setOpen = updateOpen

      return (
        <BlipEditor
          open={open()}
          onPanelOpenChange={() => undefined}
          close={() => undefined}
        />
      )
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Blip" })).toBeTruthy()
    })

    await fireEvent.click(screen.getByRole("button", { name: "New Blip" }))

    await waitFor(() => {
      expect(screen.getByTestId("mock-markdown-editor")).toBeTruthy()
    })

    setOpen(false)
    setOpen(true)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Blip" })).toBeTruthy()
    })
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
    expect(dialog?.style.getPropertyValue("--blip-editor-shell-width")).toBe("480px")
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
        "736px",
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
      widthPx: 480,
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
      widthPx: 736,
      maxHeightPx: 608,
    })
  })
})
