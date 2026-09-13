import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BlipUpdateEditor } from "@/modules/blips/components/blip-update-editor"

const {
  state,
  confirmMock,
  dialogState,
  upsertMock,
  blipIdMock,
  inlineTransitionState,
  mediaState,
} = vi.hoisted(() => ({
  state: {
    entities: [] as any[],
    viewportWidth: 375,
  },
  confirmMock: vi.fn(),
  dialogState: {
    lastProps: null as any,
  },
  upsertMock: vi.fn(async () => ({
    error: null,
    data: { id: "update-1", published: true, tags: [] },
  })),
  blipIdMock: vi.fn(() => "update-1"),
  inlineTransitionState: {
    lastProps: null as any,
  },
  // Lets a test drive the media lifecycle the editor reacts to: the FK stub
  // callback, the persisted callback, and the two accessors `canSave` reads.
  mediaState: {
    options: null as any,
    setHasMedia: (_value: boolean) => {},
    setCanPublish: (_value: boolean) => {},
    removeAttachment: vi.fn(async () => undefined),
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
  blipId: blipIdMock,
  blipStore: () => ({
    entities: () => state.entities,
    getById: (id: string) =>
      state.entities.find(blip => blip.id === id) ?? null,
    upsert: upsertMock,
    remove: vi.fn(async () => ({ error: null })),
  }),
}))

vi.mock("@/components/markdown/editor", () => ({
  MarkdownEditor: (props: any) => (
    <div
      data-testid="mock-update-markdown-editor"
      data-focus-nonce={String(props.focusNonce ?? 0)}
      data-instance-key={props.instanceKey}
      data-initial-value={props.initialValue ?? ""}>
      <button
        type="button"
        data-testid="mock-update-change"
        onClick={() => props.onChange?.("Draft update")}
      />
      {/*
        The real toolbar lives behind `EditorControls`, which this stub does not
        render. These stand in for it using the same enablement expressions, so
        the editor's `statusContext` is asserted as the DOM the author sees.
      */}
      <button
        type="button"
        data-testid="mock-update-save"
        disabled={!props.statusContext?.canSave}
        onClick={() => props.statusContext?.handleSave?.()}
      />
      <button
        type="button"
        data-testid="mock-update-publish"
        disabled={!props.statusContext?.canTogglePublish}
      />
      <button
        type="button"
        data-testid="mock-update-remove-attachment"
        onClick={() => props.aboveControlsProps?.onRemoveAttachment?.("key-1")}
      />
      <div data-testid="mock-update-status">
        {props.showStatus ? props.statusIcon : null}
      </div>
    </div>
  ),
}))

vi.mock("@/modules/blips/components/portaled-inline-transition", () => ({
  PortaledInlineTransition: (props: any) => {
    inlineTransitionState.lastProps = props

    return props.open ? (
      <div data-testid="mock-update-inline-transition">{props.children}</div>
    ) : null
  },
}))

// The media write-path is exercised in `src/modules/media/*`; here it's stubbed
// so these tests stay focused on update-editor behavior (and the real mediaStore
// never runs against the mocked Supabase client).
vi.mock("@/modules/media", async () => {
  const { createSignal } = await import("solid-js")

  return {
    mediaStore: (_client: unknown, options: any) => {
      const [hasMedia, setHasMedia] = createSignal(false)
      const [canPublish, setCanPublish] = createSignal(true)

      mediaState.options = options
      mediaState.setHasMedia = setHasMedia
      mediaState.setCanPublish = setCanPublish

      return {
        attachments: () => [],
        hasMedia,
        canPublish,
        removeAttachment: mediaState.removeAttachment,
        retry: vi.fn(),
        attach: vi.fn(),
        reset: vi.fn(),
        fetchByBlip: vi.fn(async () => ({ data: [], error: null })),
      }
    },
    validateMediaFiles: (files: File[]) => ({ accepted: files, rejected: [] }),
    clipboardMediaFiles: () => [],
    inspectClipboardMediaPaste: () => null,
    applyPasteMediaPlacement: vi.fn(async () => undefined),
    MediaButton: (props: any) => (
      <button
        type="button"
        data-testid="mock-update-media-button"
        aria-label={props.label}
      />
    ),
    ThumbnailStrip: () => <div data-testid="mock-update-thumbnail-strip" />,
    ComposerMediaChrome: () => <div data-testid="mock-update-media-chrome" />,
    ComposerPreviewModal: () => null,
    PasteMediaPlacementPrompt: () => null,
  }
})

vi.mock("@/i18n", () => ({
  ptr: (prefix: string) => {
    const values: Record<string, string> = {
      "blips.views.detail.updates.editor.editingLabel": "Editing update",
      "blips.views.detail.updates.editor.newLabel": "New update",
      "blips.views.detail.updates.placeholder": "Share an update",
      "blips.views.detail.updates.actions.close": "Close",
      "blips.views.detail.updates.actions.delete": "Delete",
      "blips.views.detail.updates.confirmDelete.title": "Delete update?",
      "blips.views.detail.updates.confirmDelete.persistedPrompt":
        "Delete persisted update?",
      "blips.views.detail.updates.confirmDelete.unsavedPrompt":
        "Delete unsaved update?",
      "blips.views.detail.updates.confirmDelete.actions.confirm": "Delete",
      "blips.views.detail.updates.confirmDelete.actions.confirming":
        "Deleting...",
      "blips.views.detail.updates.confirmDelete.actions.cancel": "Cancel",
      "blips.views.detail.updates.confirmCloseDraft.title": "Discard draft?",
      "blips.views.detail.updates.confirmCloseDraft.prompt":
        "Close without saving?",
      "blips.views.detail.updates.confirmCloseDraft.actions.close": "Close",
      "blips.views.detail.updates.confirmCloseDraft.actions.closing":
        "Closing...",
      "blips.views.detail.updates.confirmCloseDraft.actions.cancel":
        "Keep editing",
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
    upsertMock.mockClear()
    blipIdMock.mockReset()
    blipIdMock.mockImplementation(() => "update-1")
    dialogState.lastProps = null
    inlineTransitionState.lastProps = null
    mediaState.options = null
    mediaState.removeAttachment.mockClear()
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
    expect(screen.getByTestId("mock-dialog-title").textContent).toBe(
      "New update",
    )
    expect(dialogState.lastProps.forceMount).toBeUndefined()
  })

  it("keeps the inline shell on desktop", async () => {
    state.viewportWidth = 1024
    render(() =>
      (() => {
        const [desktopMount, setDesktopMount] =
          createSignal<HTMLDivElement | null>(null)

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
      })(),
    )

    await waitFor(() => {
      expect(screen.getByTestId("mock-update-markdown-editor")).toBeTruthy()
    })
    expect(screen.queryByTestId("mock-update-dialog")).toBeNull()
    expect(screen.getByTestId("mock-update-inline-transition")).toBeTruthy()
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
          screen
            .getByTestId("mock-update-markdown-editor")
            .getAttribute("data-focus-nonce"),
        ),
      ).toBeGreaterThan(1)
    })

    setFocusNonce(2)

    await waitFor(() => {
      expect(
        Number(
          screen
            .getByTestId("mock-update-markdown-editor")
            .getAttribute("data-focus-nonce"),
        ),
      ).toBeGreaterThan(2)
    })
  })

  it("auto-saves pending update drafts after the debounce interval", async () => {
    vi.useFakeTimers()

    render(() => (
      <BlipUpdateEditor
        open
        rootBlipId="root-1"
        onRequestClose={() => undefined}
      />
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-update-markdown-editor")).toBeTruthy()
    })

    await fireEvent.click(screen.getByTestId("mock-update-change"))
    expect(upsertMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)

    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock.mock.calls[0]?.[0]).toMatchObject({
      id: "update-1",
      content: "Draft update",
      parent_id: "root-1",
      blip_type: "update",
    })

    vi.useRealTimers()
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

  it("opens empty on mobile after closing a published update and starting a new one", async () => {
    state.viewportWidth = 375
    const [open, setOpen] = createSignal(true)
    let nextUpdateId = 1
    blipIdMock.mockImplementation(() => `update-${nextUpdateId++}`)

    render(() => (
      <BlipUpdateEditor
        open={open()}
        rootBlipId="root-1"
        focusNonce={open() ? 1 : 0}
        onRequestClose={() => setOpen(false)}
      />
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-update-dialog")).toBeTruthy()
    })

    const firstSessionKey = screen
      .getByTestId("mock-update-markdown-editor")
      .getAttribute("data-instance-key")

    await fireEvent.click(screen.getByTestId("mock-update-change"))
    setOpen(false)

    await waitFor(() => {
      expect(screen.queryByTestId("mock-update-markdown-editor")).toBeNull()
    })
    expect(inlineTransitionState.lastProps).toBeNull()

    setOpen(true)

    await waitFor(() => {
      const editor = screen.getByTestId("mock-update-markdown-editor")
      expect(editor.getAttribute("data-initial-value")).toBe("")
      expect(editor.getAttribute("data-instance-key")).not.toBe(firstSessionKey)
    })
    expect(screen.getByTestId("mock-dialog-title").textContent).toBe(
      "New update",
    )
  })

  it("wires desktop inline transition exit cleanup", async () => {
    state.viewportWidth = 1024

    render(() =>
      (() => {
        const [desktopMount, setDesktopMount] =
          createSignal<HTMLDivElement | null>(null)

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
      })(),
    )

    await waitFor(() => {
      expect(inlineTransitionState.lastProps?.onAfterExit).toBeTypeOf(
        "function",
      )
    })
    expect(screen.queryByTestId("mock-update-dialog")).toBeNull()
  })

  it("opens empty on desktop after inline transition exit and reopen", async () => {
    state.viewportWidth = 1024
    let nextUpdateId = 1
    blipIdMock.mockImplementation(() => `update-${nextUpdateId++}`)

    const [open, setOpen] = createSignal(true)
    const [desktopMount, setDesktopMount] = createSignal<HTMLDivElement | null>(
      null,
    )

    render(() => (
      <>
        <div
          data-testid="mock-update-desktop-mount"
          ref={element => setDesktopMount(element)}
        />
        <BlipUpdateEditor
          open={open()}
          rootBlipId="root-1"
          desktopMount={desktopMount()}
          onRequestClose={() => setOpen(false)}
        />
      </>
    ))

    await waitFor(() => {
      expect(screen.getByTestId("mock-update-markdown-editor")).toBeTruthy()
    })

    const firstSessionKey = screen
      .getByTestId("mock-update-markdown-editor")
      .getAttribute("data-instance-key")

    await fireEvent.click(screen.getByTestId("mock-update-change"))
    setOpen(false)
    inlineTransitionState.lastProps?.onAfterExit?.()
    setOpen(true)

    await waitFor(() => {
      const editor = screen.getByTestId("mock-update-markdown-editor")
      expect(editor.getAttribute("data-initial-value")).toBe("")
      expect(editor.getAttribute("data-instance-key")).not.toBe(firstSessionKey)
    })
  })

  it("loads existing update content when editing", async () => {
    state.entities = [
      {
        id: "update-existing",
        content: "Previously published update",
        blip_type: "update",
        published: true,
      },
    ]

    render(() => (
      <BlipUpdateEditor
        open
        rootBlipId="root-1"
        editingUpdateId="update-existing"
        onRequestClose={() => undefined}
      />
    ))

    await waitFor(() => {
      const editor = screen.getByTestId("mock-update-markdown-editor")
      expect(editor.getAttribute("data-initial-value")).toBe(
        "Previously published update",
      )
      expect(editor.getAttribute("data-instance-key")).toBe(
        "blip-update-editor:update-existing",
      )
    })
    expect(screen.getByTestId("mock-dialog-title").textContent).toBe(
      "Editing update",
    )
  })

  /**
   * Regression suite for the media-only update. Attaching a photo writes a
   * `blip_media` row directly, leaving no trace in `content`, so every signal
   * the toolbar reads has to be driven from the media callbacks. Two separate
   * bugs shipped here: `makeEnsureBlipPersisted` never recorded the FK stub it
   * created (so publish and delete stayed dead), and save was gated on the
   * absence of that stub (so the first attach suppressed save permanently).
   */
  describe("media-only updates", () => {
    const renderEditor = () =>
      render(() => (
        <BlipUpdateEditor
          open
          rootBlipId="root-1"
          onRequestClose={() => undefined}
        />
      ))

    /** Mirrors a picked file uploading, processing, and its row landing. */
    const completeMediaUpload = async () => {
      await mediaState.options.ensureBlipPersisted()
      mediaState.setHasMedia(true)
      mediaState.setCanPublish(true)
      mediaState.options.onMediaPersisted()
    }

    const save = () =>
      screen.getByTestId("mock-update-save") as HTMLButtonElement
    const publish = () =>
      screen.getByTestId("mock-update-publish") as HTMLButtonElement

    it("offers no save on an untouched update", async () => {
      renderEditor()

      await waitFor(() => expect(mediaState.options).not.toBeNull())
      expect(save().disabled).toBe(true)
    })

    it("enables save once an attachment has landed", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      await completeMediaUpload()

      await waitFor(() => expect(save().disabled).toBe(false))
    })

    it("keeps save disabled while the upload is still in flight", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      // A file is attached but variants are still generating: `canPublish` is
      // false, so save must not be offered mid-upload.
      mediaState.setHasMedia(true)
      mediaState.setCanPublish(false)
      mediaState.options.onMediaPersisted()

      await waitFor(() => expect(mediaState.options).not.toBeNull())
      expect(save().disabled).toBe(true)
    })

    it("persists the FK stub as an unpublished database-only row", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      await mediaState.options.ensureBlipPersisted()

      expect(upsertMock).toHaveBeenCalledTimes(1)
      // The stub only exists to satisfy the `blip_media.blip_id` foreign key;
      // publishing it would leak an empty update into the timeline.
      expect(upsertMock.mock.calls[0]?.[0]).toMatchObject({
        id: "update-1",
        parent_id: "root-1",
        blip_type: "update",
        published: false,
      })
    })

    it("creates the FK stub only once across several attachments", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      await mediaState.options.ensureBlipPersisted()
      await mediaState.options.ensureBlipPersisted()
      await mediaState.options.ensureBlipPersisted()

      // Idempotence depends on the stub being recorded after it is written —
      // the exact step that was missing.
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    it("makes the update publishable as soon as the stub exists", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      expect(publish().disabled).toBe(true)

      await completeMediaUpload()

      // `canTogglePublish` is `hasPersistedCurrentUpdate() && !hasPendingChanges()`,
      // and the update editor's pending-changes test is text-only. So a
      // media-only update can be published straight away — it never could while
      // the stub went unrecorded, which is what made attached media unreachable.
      await waitFor(() => expect(publish().disabled).toBe(false))
    })

    it("clears the media edit once saved so save settles back down", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      await completeMediaUpload()
      await waitFor(() => expect(save().disabled).toBe(false))

      await fireEvent.click(save())

      await waitFor(() => expect(save().disabled).toBe(true))
      expect(upsertMock.mock.calls.at(-1)?.[0]).toMatchObject({
        id: "update-1",
        published: true,
      })
    })

    it("treats removing an attachment as an edit worth saving", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      await completeMediaUpload()
      await waitFor(() => expect(save().disabled).toBe(false))
      await fireEvent.click(save())
      await waitFor(() => expect(save().disabled).toBe(true))

      await fireEvent.click(screen.getByTestId("mock-update-remove-attachment"))

      expect(mediaState.removeAttachment).toHaveBeenCalledWith("key-1")
      await waitFor(() => expect(save().disabled).toBe(false))
    })

    it("reports the attachment through the save status indicator", async () => {
      renderEditor()
      await waitFor(() => expect(mediaState.options).not.toBeNull())

      expect(
        screen
          .getByTestId("mock-update-status")
          .querySelector(".status-saved-icon"),
      ).toBeNull()

      await completeMediaUpload()

      // Nothing else acknowledges a media-only attachment, so the save
      // indicator is reused to confirm the row reached the database.
      await waitFor(() =>
        expect(
          screen
            .getByTestId("mock-update-status")
            .querySelector(".status-saved-icon"),
        ).toBeTruthy(),
      )
    })
  })
})
